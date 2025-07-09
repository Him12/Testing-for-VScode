/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: Staging Data Integration
 * Description: This script fetches data from the CSV file 'Book1.csv' in the file cabinet (folder ID 2777783),
 * compares item location data using location names from the file and a direct search, creates or updates custom records for staging data,
 * and attaches them to the Staging Data subtab on inventory items. Uses native JavaScript for CSV parsing and includes detailed
 * logging for data extraction, location comparison, custom record creation/update, and attachment.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-06-18 | Yogesh Bhurley   | Initial version                          |
 */

/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/file', 'N/record', 'N/search', 'N/runtime'], function(file, record, search, runtime) {
    
    function getInputData() {
        try {
            var folderId = 2777783;
            var fileSearch = search.create({
                type: 'file',
                filters: [
                    ['folder', 'is', folderId],
                    'AND',
                    ['name', 'is', 'Book1.csv']
                ],
                columns: ['internalid']
            });
            var fileId = fileSearch.run().getRange({ start: 0, end: 1 })[0].getValue('internalid');
            var csvFile = file.load({ id: fileId });
            log.debug('CSV File Loaded', 'File ID: ' + csvFile.id + ', Name: Book1.csv, Folder: ' + folderId);

            var csvContent = csvFile.getContents();
            log.debug('CSV Content', 'Raw Content: ' + csvContent);
            var csvLines = csvContent.split(/\r?\n/);
            var headers = csvLines[0].split(',').map(function(header) {
                return header.trim();
            });
            var data = [];

            // Aggregate netSuiteReduction by location
            var locationReductions = {};
            for (var i = 1; i < csvLines.length; i++) {
                if (!csvLines[i]) continue;
                var fields = csvLines[i].split(',').map(function(field) {
                    return field.trim();
                });
                var rowData = {};
                for (var j = 0; j < headers.length; j++) {
                    rowData[headers[j]] = fields[j] || '';
                }
                var itemId = rowData['MEMBER_INTERNAL_ID'];
                var locationName = rowData['LOCATION']; // Use location name from CSV
                log.debug('Location Name in File', 'Item ID: ' + itemId + ', Location Name: ' + locationName);
                var netSuiteReduction = parseFloat(rowData['Staging Data']) || 0;
                if (itemId && locationName) {
                    var key = itemId + '_' + locationName;
                    locationReductions[key] = netSuiteReduction;
                }
                data.push(rowData);
                log.debug('Parsed CSV Row', 'Row ' + i + ': ' + JSON.stringify(rowData));
            }

            // Attach locationReductions to each row
            data.forEach(function(row) {
                row.locationReductions = locationReductions;
            });

            log.audit('Input Data Prepared', 'Total Rows: ' + data.length);
            return data.length > 0 ? data : [{ 'MEMBER_INTERNAL_ID': '6585' }]; // Fallback to process item 6585
        } catch (e) {
            log.error('GetInputData Error', 'Error in getInputData: ' + e.message + ', Stack: ' + e.stack);
            return [{ 'MEMBER_INTERNAL_ID': '6585' }]; // Fallback to process item 6585
        }
    }
    
    function map(context) {
        try {
            var row = JSON.parse(context.value);
            log.debug('Map Start', 'Processing Row Data: ' + JSON.stringify(row));

            var itemId = row['MEMBER_INTERNAL_ID'];
            var csvLocationName = row['LOCATION']; // Use location name from CSV
            var locationReductions = row.locationReductions;

            if (!itemId) {
                log.error('Invalid Row', 'Row missing item ID: ' + JSON.stringify(row));
                return;
            }

            log.debug('Data Extracted', 'Item ID: ' + itemId + ', CSV Location Name: ' + csvLocationName);

            var itemRecord = record.load({
                type: record.Type.INVENTORY_ITEM,
                id: itemId,
                isDynamic: false
            });

            var lineCount = itemRecord.getLineCount({ sublistId: 'locations' });
            log.debug('Location Check', 'Item ID: ' + itemId + ', Location sublist lines: ' + lineCount);

            // Log all locations before processing
            var processedLocations = [];
            for (var j = 0; j < lineCount; j++) {
                var locId = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'location',
                    line: j
                });
                var locationName = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'locationname',
                    line: j
                }) || locId;
                log.debug('Sublist Location', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ' at line ' + j);
                processedLocations.push(locId);
            }

            if (lineCount === 0) {
                log.error('No Locations', 'No locations found for Item ID: ' + itemId);
                return;
            }

            // Fetch location mapping using direct search on location record type
            var locationSearch = search.create({
                type: search.Type.LOCATION,
                filters: [
                    ['isinactive', 'is', 'F'] // Only active locations
                ],
                columns: [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'name' })
                ]
            });
            log.debug('Location Search Created', 'Searching for active locations');
            var locationResults = locationSearch.run().getRange({ start: 0, end: 1000 });
            log.debug('Location Search Results', 'Number of results: ' + locationResults.length);
            var locationMap = {};
            locationResults.forEach(function(result) {
                var locId = result.getValue({ name: 'internalid' });
                var locName = result.getValue({ name: 'name' });
                if (locId && locName) {
                    locationMap[locName] = locId;
                    log.debug('Mapped Location', 'Location Name: ' + locName + ', Internal ID: ' + locId);
                    // Check for partial match (e.g., numeric part)
                    var numericMatch = locName.match(/\d+/);
                    if (numericMatch) {
                        var numericPart = numericMatch[0];
                        locationMap[numericPart] = locId; // Map numeric part as well
                        log.debug('Mapped Numeric Part', 'Numeric Part: ' + numericPart + ', Internal ID: ' + locId);
                    }
                }
            });
            log.debug('JSON Created', 'Location Map: ' + JSON.stringify(locationMap));

            var matchedLocId = locationMap[csvLocationName];
            // Fallback to find a location where csvLocationName is a substring or numeric part
            if (!matchedLocId) {
                for (var locName in locationMap) {
                    if (locName.includes(csvLocationName) || (csvLocationName.match(/\d+/) && locName.includes(csvLocationName.match(/\d+/)[0]))) {
                        matchedLocId = locationMap[locName];
                        log.debug('Partial Match Found', 'CSV Location Name: ' + csvLocationName + ', Matched Location Name: ' + locName + ', Matched Location ID: ' + matchedLocId);
                        break;
                    }
                }
            }
            log.debug('Location Name Found from File', 'CSV Location Name: ' + csvLocationName + ', Matched Location ID: ' + matchedLocId);
            if (!matchedLocId) {
                log.debug('Location Not Found', 'No matching location ID found for name: ' + csvLocationName);
                return;
            }
            log.debug('Location Internal ID Found', 'Using Location ID: ' + matchedLocId + ' for Item ID: ' + itemId);

            // Process in batches with error handling
            var batchSize = 20;
            var usage = runtime.getCurrentScript().getRemainingUsage();
            log.debug('Initial Governance Usage', 'Remaining Units: ' + usage);
            for (var j = 0; j < lineCount; j += batchSize) {
                var end = Math.min(j + batchSize, lineCount);
                try {
                    usage = runtime.getCurrentScript().getRemainingUsage();
                    log.debug('Batch Start', 'Processing batch from line ' + j + ' to ' + (end - 1) + ', Remaining Units: ' + usage);
                    for (var k = j; k < end; k++) {
                        var locId = itemRecord.getSublistValue({
                            sublistId: 'locations',
                            fieldId: 'location',
                            line: k
                        });
                        var locationName = itemRecord.getSublistValue({
                            sublistId: 'locations',
                            fieldId: 'locationname',
                            line: k
                        }) || locId;
                        log.debug('Processing Location', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ' at line ' + j);

                        if (processedLocations.indexOf(locId) === -1) {
                            log.debug('Skipped Location', 'Location ID: ' + locId + ', Name: ' + locationName + ' was not in initial sublist scan for Item ID: ' + itemId);
                            continue;
                        }

                        var key = itemId + '_' + matchedLocId; // Use matched location ID for key
                        var netSuiteReduction = locationReductions[itemId + '_' + csvLocationName] || 0;
                        var isCsvMatch = (locId == matchedLocId);
                        log.debug('Location Data', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Is CSV Match: ' + isCsvMatch + ', NetSuite Reduction: ' + netSuiteReduction);

                        // Retrieve and validate date values
                        var lastInvtCountDate = itemRecord.getSublistValue({
                            sublistId: 'locations',
                            fieldId: 'lastinvtcountdate',
                            line: k
                        });
                        var nextInvtCountDate = itemRecord.getSublistValue({
                            sublistId: 'locations',
                            fieldId: 'nextinvtcountdate',
                            line: k
                        });
                        
                        log.audit('Raw Date Values', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Last Count Date: ' + (lastInvtCountDate || 'null') + ', Next Count Date: ' + (nextInvtCountDate || 'null'));

                        var locationData = {
                            itemId: itemId,
                            locationId: matchedLocId, // Use matched location ID
                            netSuiteReduction: netSuiteReduction,
                            onHand: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityonhand',
                                line: k
                            }) || 0 : 0,
                            available: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityavailable',
                                line: k
                            }) || 0 : 0,
                            onOrder: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityonorder',
                                line: k
                            }) || 0 : 0,
                            committed: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantitycommitted',
                                line: k
                            }) || 0 : 0,
                            backOrdered: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantitybackordered',
                                line: k
                            }) || 0 : 0,
                            inTransit: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityintransit',
                                line: k
                            }) || 0 : 0,
                            reorderPoint: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'savedreorderpoint',
                                line: k
                            }) || 0 : 0,
                            preferredStockLevel: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'preferredstocklevel',
                                line: k
                            }) || 0 : 0,
                            stockUnit: itemRecord.getValue({
                                fieldId: 'stockunit'
                            }) || '',
                            value: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'onhandvaluemli',
                                line: k
                            }) || 0 : 0,
                            averageCost: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'averagecostmli',
                                line: k
                            }) || 0 : 0,
                            lastPurchasePrice: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'lastpurchasepricekey',
                                line: k
                            }) || 0 : 0,
                            leadTime: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'leadtime',
                                line: k
                            }) || 0 : 0,
                            safetyStockLevel: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'safetystocklevel',
                                line: k
                            }) || 0 : 0,
                            defaultReturnCost: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'defaultreturncost',
                                line: k
                            }) || 0 : 0,
                            quantityAvailableBase: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityavailablebase',
                                line: k
                            }) || 0 : 0,
                            lastInvtCountDate: isCsvMatch ? (lastInvtCountDate ? lastInvtCountDate : null) : null,
                            nextInvtCountDate: isCsvMatch ? (nextInvtCountDate ? nextInvtCountDate : null) : null,
                            invtCountInterval: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'invtcountinterval',
                                line: k
                            }) || 0 : 0,
                            invtClassification: isCsvMatch ? itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'invtclassification',
                                line: k
                            }) || '' : ''
                        };

                        // Calculate only for the matched location
                        if (isCsvMatch && netSuiteReduction > 0) {
                            locationData.stagedQty = locationData.netSuiteReduction - locationData.onHand;
                            locationData.availableQty = locationData.onHand - locationData.stagedQty;
                        } else {
                            locationData.stagedQty = 0;
                            locationData.availableQty = 0;
                            log.debug('Skipped Calculation', 'No calculations for non-matching location ID: ' + locId + ', Name: ' + locationName);
                        }

                        log.debug('Calculated Quantities', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ', Staged Quantity: ' + locationData.stagedQty + ', Available Quantity: ' + locationData.availableQty);
                        log.audit('Before Write', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Last Count Date: ' + (locationData.lastInvtCountDate || 'null') + ', Next Count Date: ' + (locationData.nextInvtCountDate || 'null'));
                        // Proactive governance check
                        usage = runtime.getCurrentScript().getRemainingUsage();
                        if (usage < 500) {
                            log.debug('Governance Warning', 'Remaining Units: ' + usage + '. Yielding at line ' + k);
                            return;
                        }
                        try {
                            context.write({
                                key: itemId + '_' + matchedLocId, // Use matched location ID
                                value: JSON.stringify(locationData)
                            });
                            log.debug('After Write', 'Item ID: ' + itemId + ', Location ID: ' + matchedLocId);
                        } catch (writeError) {
                            log.error('Write Error', 'Failed to write context for Item ID: ' + itemId + ', Location ID: ' + matchedLocId + ', Message: ' + writeError.message + ', Stack: ' + writeError.stack);
                        }
                    }
                    log.debug('Batch Completed', 'Finished processing batch from line ' + j + ' to ' + (end - 1));
                } catch (batchError) {
                    log.error('Batch Error', 'Error processing batch from line ' + j + ' to ' + (end - 1) + ', Message: ' + batchError.message + ', Stack: ' + batchError.stack);
                }
                // Additional governance check after batch
                usage = runtime.getCurrentScript().getRemainingUsage();
                if (usage < 500) {
                    log.debug('Governance Warning', 'Remaining Units: ' + usage + '. Yielding after batch ending at line ' + (end - 1));
                    return;
                }
            }
            log.debug('Map Completed', 'Processed all ' + lineCount + ' locations for Item ID: ' + itemId);
        } catch (e) {
            log.error('Map Error', 'Error processing file ID: ' + (context.value ? JSON.parse(context.value).fileId : 'unknown') + ', Message: ' + e.message + ', Stack: ' + e.stack);
        }
    }
    
    function reduce(context) {
        try {
            var keyParts = context.key.split('_');
            var itemId = keyParts[0];
            var locationId = keyParts[1];
            var locationData = JSON.parse(context.values[0]);
            log.debug('Reduce Start', 'Processing Item ID: ' + itemId + ', Location ID: ' + locationId + ' (from key), Data: ' + JSON.stringify(locationData));

            // Ensure locationId from key is used
            locationData.locationId = locationId;

            var existingRecordId = null;
            var customRecordSearch = search.create({
                type: 'customrecord_ous__staging_data',
                filters: [
                    ['custrecordous_item_link', 'is', itemId],
                    'AND',
                    ['custrecordous_location', 'is', locationId]
                ],
                columns: ['internalid']
            });
            
            var searchResults = customRecordSearch.run().getRange({ start: 0, end: 1 });
            if (searchResults.length > 0) {
                existingRecordId = searchResults[0].getValue('internalid');
                log.debug('Existing Record Found', 'Found existing custom record ID: ' + existingRecordId + ' for Item ID: ' + itemId + ', Location ID: ' + locationId);
            } else {
                log.debug('No Existing Record', 'No custom record found for Item ID: ' + itemId + ', Location ID: ' + locationId);
            }
            
            var customRecord;
            if (existingRecordId) {
                customRecord = record.load({
                    type: 'customrecord_ous__staging_data',
                    id: existingRecordId,
                    isDynamic: true
                });
                log.debug('Loading Existing Record', 'Loaded custom record ID: ' + existingRecordId);
            } else {
                customRecord = record.create({
                    type: 'customrecord_ous__staging_data',
                    isDynamic: true
                });
                log.debug('Creating New Record', 'Creating new custom record for Item ID: ' + itemId + ', Location ID: ' + locationId);
                // Set default values for new record
                customRecord.setValue({ fieldId: 'custrecordous_location', value: locationId });
                customRecord.setValue({ fieldId: 'custrecordous_item_link', value: itemId });
                customRecord.setValue({ fieldId: 'custrecordous_on_hand', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: locationData.stagedQty || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: locationData.availableQty || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_on_order', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_committed', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_available', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_back_ordered', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_in_transit', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_reorder_point', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_pref_stock_level', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_stock_unit', value: locationData.stockUnit || '' });
                customRecord.setValue({ fieldId: 'custrecordous_value', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_averagecostmli', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_lastpurchasepricekey', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_leadtime', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_safetystocklevel', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_defaultreturncost', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_quantityavailablebase', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_lastinvtcountdate', value: null });
                customRecord.setValue({ fieldId: 'custrecordous_nextinvtcountdate', value: null });
                customRecord.setValue({ fieldId: 'custrecordous_invtcountinterval', value: 0 });
                customRecord.setValue({ fieldId: 'custrecordous_invtclassification', value: '' });
            }
            
            // Update with calculated or provided values
            customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: locationData.stagedQty || customRecord.getValue({ fieldId: 'custrecordous_staged_qty' }) || 0 });
            customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: locationData.availableQty || customRecord.getValue({ fieldId: 'custrecordous_available_qty' }) || 0 });
            customRecord.setValue({ fieldId: 'custrecordous_net_suite_reduction', value: locationData.netSuiteReduction || 0 }); // Added field for reduction

            var customRecordId = customRecord.save();
            
            if (!existingRecordId) {
                try {
                    record.attach({
                        record: { type: 'customrecord_ous__staging_data', id: customRecordId },
                        to: { type: record.Type.INVENTORY_ITEM, id: locationData.itemId },
                        attributes: { subtab: 'custtab_staging_data' }
                    });
                    log.debug('Record Attached', 'Custom Record ID: ' + customRecordId + ' attached to Item ID: ' + locationData.itemId + ' on subtab custtab_staging_data');
                } catch (attachError) {
                    log.error('Attachment Error', 'Failed to attach record: Item ID: ' + locationData.itemId + ', Custom Record ID: ' + customRecordId + ', Message: ' + attachError.message + ', Stack: ' + attachError.stack);
                }
            } else {
                log.debug('Record Attachment Skipped', 'Custom Record ID: ' + customRecordId + ' already attached to Item ID: ' + locationData.itemId);
            }
        } catch (e) {
            log.error('Reduce Error', 'Error processing Item ID: ' + (locationData ? locationData.itemId : 'unknown') + ', Location ID: ' + (locationData ? locationData.locationId : 'unknown') + ', Message: ' + e.message + ', Stack: ' + e.stack);
        }
    }
    
    function summarize(summary) {
        try {
            if (summary.mapErrors && Array.isArray(summary.mapErrors)) {
                summary.mapErrors.forEach(function(error) {
                    log.error('Map Error', 'Map error: ' + JSON.stringify(error));
                });
            } else {
                log.debug('Summarize', 'No map errors found.');
            }
            
            if (summary.reduceErrors && Array.isArray(summary.reduceErrors)) {
                summary.reduceErrors.forEach(function(error) {
                    log.error('Reduce Error', 'Reduce error: ' + JSON.stringify(error));
                });
            } else {
                log.debug('Summarize', 'No reduce errors found.');
            }
            
            log.audit('Summary', 'Processing completed. Total records processed: ' + (summary.inputSummary.total || 0));
        } catch (e) {
            log.error('Summarize Error', 'Error in summarize: ' + e.message + ', Stack: ' + e.stack);
        }
    }
    
    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});