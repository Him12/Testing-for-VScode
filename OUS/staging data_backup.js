/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: Staging Data Integration
 * Description: This script fetches data from the CSV file 'Book1.csv' in the file cabinet (folder ID 2777783),
 * compares item location data, creates or updates custom records for staging data, and attaches them to the
 * Staging Data subtab on inventory items. Uses native JavaScript for CSV parsing and includes detailed
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
                var locationId = rowData['LOCATION'];
                var netSuiteReduction = parseFloat(rowData['Staging Data']) || 0;
                if (itemId && locationId) {
                    var key = itemId + '_' + locationId;
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
            var csvLocationId = row['LOCATION'];
            var locationReductions = row.locationReductions;

            if (!itemId) {
                log.error('Invalid Row', 'Row missing item ID: ' + JSON.stringify(row));
                return;
            }

            log.debug('Data Extracted', 'Item ID: ' + itemId + ', CSV Location ID: ' + csvLocationId);

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
                        log.debug('Processing Location', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ' at line ' + k);

                        if (processedLocations.indexOf(locId) === -1) {
                            log.warn('Skipped Location', 'Location ID: ' + locId + ', Name: ' + locationName + ' was not in initial sublist scan for Item ID: ' + itemId);
                            continue;
                        }

                        var key = itemId + '_' + locId;
                        var netSuiteReduction = locationReductions[key] || 0;
                        var isCsvMatch = (locId == csvLocationId);
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
                            locationId: locId,
                            netSuiteReduction: netSuiteReduction,
                            onHand: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityonhand',
                                line: k
                            }) || 0,
                            available: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityavailable',
                                line: k
                            }) || 0,
                            onOrder: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityonorder',
                                line: k
                            }) || 0,
                            committed: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantitycommitted',
                                line: k
                            }) || 0,
                            backOrdered: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantitybackordered',
                                line: k
                            }) || 0,
                            inTransit: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityintransit',
                                line: k
                            }) || 0,
                            reorderPoint: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'savedreorderpoint',
                                line: k
                            }) || 0,
                            preferredStockLevel: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'preferredstocklevel',
                                line: k
                            }) || 0,
                            stockUnit: itemRecord.getValue({
                                fieldId: 'stockunit'
                            }) || '',
                            value: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'onhandvaluemli',
                                line: k
                            }) || 0,
                            averageCost: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'averagecostmli',
                                line: k
                            }) || 0,
                            lastPurchasePrice: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'lastpurchasepricekey',
                                line: k
                            }) || 0,
                            leadTime: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'leadtime',
                                line: k
                            }) || 0,
                            safetyStockLevel: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'safetystocklevel',
                                line: k
                            }) || 0,
                            defaultReturnCost: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'defaultreturncost',
                                line: k
                            }) || 0,
                            quantityAvailableBase: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'quantityavailablebase',
                                line: k
                            }) || 0,
                            lastInvtCountDate: lastInvtCountDate ? lastInvtCountDate : null,
                            nextInvtCountDate: nextInvtCountDate ? nextInvtCountDate : null,
                            invtCountInterval: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'invtcountinterval',
                                line: k
                            }) || 0,
                            invtClassification: itemRecord.getSublistValue({
                                sublistId: 'locations',
                                fieldId: 'invtclassification',
                                line: k
                            }) || ''
                        };

                        // Calculate only for locations present in CSV, but always write to context
                        if (netSuiteReduction > 0) {
                            locationData.stagedQty = locationData.netSuiteReduction - locationData.onHand;
                            locationData.availableQty = locationData.onHand - locationData.stagedQty;
                        } else {
                            locationData.stagedQty = 0;
                            locationData.availableQty = 0;
                            log.debug('Skipped Calculation', 'No calculations for non-CSV location ID: ' + locId + ', Name: ' + locationName);
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
                                key: itemId + '_' + locId,
                                value: JSON.stringify(locationData)
                            });
                            log.debug('After Write', 'Item ID: ' + itemId + ', Location ID: ' + locId);
                        } catch (writeError) {
                            log.error('Write Error', 'Failed to write context for Item ID: ' + itemId + ', Location ID: ' + locId + ', Message: ' + writeError.message + ', Stack: ' + writeError.stack);
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
            var locationData = JSON.parse(context.values[0]);
            log.debug('Reduce Start', 'Processing Item ID: ' + locationData.itemId + ', Location ID: ' + locationData.locationId);
            
            var existingRecordId = null;
            var customRecordSearch = search.create({
                type: 'customrecord_ous__staging_data',
                filters: [
                    ['custrecordous_item_link', 'is', locationData.itemId],
                    'AND',
                    ['custrecordous_location', 'is', locationData.locationId]
                ],
                columns: ['internalid']
            });
            
            var searchResults = customRecordSearch.run().getRange({ start: 0, end: 1 });
            if (searchResults.length > 0) {
                existingRecordId = searchResults[0].getValue('internalid');
                log.debug('Existing Record Found', 'Found existing custom record ID: ' + existingRecordId + ' for Item ID: ' + locationData.itemId + ', Location ID: ' + locationData.locationId);
            } else {
                log.debug('No Existing Record', 'No custom record found for Item ID: ' + locationData.itemId + ', Location ID: ' + locationData.locationId);
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
                log.debug('Creating New Record', 'Creating new custom record for Item ID: ' + locationData.itemId + ', Location ID: ' + locationData.locationId);
            }
            
           // log.debug('Setting Custom Record Fields', 'Item ID: ' + locationData.itemId + ', Location ID: ' + locationData.locationId);
            customRecord.setValue({ fieldId: 'custrecordous_location', value: locationData.locationId });
           // log.debug('Field Set', 'custrecordous_location: ' + locationData.locationId);
            
            customRecord.setValue({ fieldId: 'custrecordous_item_link', value: locationData.itemId });
           // log.debug('Field Set', 'custrecordous_item_link: ' + locationData.itemId);
            
            customRecord.setValue({ fieldId: 'custrecordous_on_hand', value: locationData.onHand });
           // log.debug('Field Set', 'custrecordous_on_hand: ' + locationData.onHand);
            
            customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: locationData.stagedQty });
           // log.debug('Field Set', 'custrecordous_staged_qty: ' + locationData.stagedQty);
            
            customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: locationData.availableQty });
           // log.debug('Field Set', 'custrecordous_available_qty: ' + locationData.availableQty);
            
            customRecord.setValue({ fieldId: 'custrecordous_on_order', value: locationData.onOrder });
           // log.debug('Field Set', 'custrecordous_on_order: ' + locationData.onOrder);
            
            customRecord.setValue({ fieldId: 'custrecordous_committed', value: locationData.committed });
           // log.debug('Field Set', 'custrecordous_committed: ' + locationData.committed);
            
            customRecord.setValue({ fieldId: 'custrecordous_available', value: locationData.available });
           // log.debug('Field Set', 'custrecordous_available: ' + locationData.available);
            
            customRecord.setValue({ fieldId: 'custrecordous_back_ordered', value: locationData.backOrdered });
          //  log.debug('Field Set', 'custrecordous_back_ordered: ' + locationData.backOrdered);
            
            customRecord.setValue({ fieldId: 'custrecordous_in_transit', value: locationData.inTransit });
           // log.debug('Field Set', 'custrecordous_in_transit: ' + locationData.inTransit);
            
            customRecord.setValue({ fieldId: 'custrecordous_reorder_point', value: locationData.reorderPoint });
           // log.debug('Field Set', 'custrecordous_reorder_point: ' + locationData.reorderPoint);
            
            customRecord.setValue({ fieldId: 'custrecordous_pref_stock_level', value: locationData.preferredStockLevel });
           // log.debug('Field Set', 'custrecordous_pref_stock_level: ' + locationData.preferredStockLevel);
            
            customRecord.setValue({ fieldId: 'custrecordous_stock_unit', value: locationData.stockUnit });
          //  log.debug('Field Set', 'custrecordous_stock_unit: ' + locationData.stockUnit);
            
            // Additional fields
            customRecord.setValue({ fieldId: 'custrecordous_value', value: locationData.value });
          //  log.debug('Field Set', 'custrecordous_value: ' + locationData.value);
            
            customRecord.setValue({ fieldId: 'custrecordous_averagecostmli', value: locationData.averageCost });
           // log.debug('Field Set', 'custrecordous_averagecostmli: ' + locationData.averageCost);
            
            customRecord.setValue({ fieldId: 'custrecordous_lastpurchasepricekey', value: locationData.lastPurchasePrice });
            //log.debug('Field Set', 'custrecordous_lastpurchasepricekey: ' + locationData.lastPurchasePrice);
            
            customRecord.setValue({ fieldId: 'custrecordous_leadtime', value: locationData.leadTime });
           // log.debug('Field Set', 'custrecordous_leadtime: ' + locationData.leadTime);
            
            customRecord.setValue({ fieldId: 'custrecordous_safetystocklevel', value: locationData.safetyStockLevel });
            //log.debug('Field Set', 'custrecordous_safetystocklevel: ' + locationData.safetyStockLevel);
            
            customRecord.setValue({ fieldId: 'custrecordous_defaultreturncost', value: locationData.defaultReturnCost });
           // log.debug('Field Set', 'custrecordous_defaultreturncost: ' + locationData.defaultReturnCost);
            
            customRecord.setValue({ fieldId: 'custrecordous_quantityavailablebase', value: locationData.quantityAvailableBase });
          //  log.debug('Field Set', 'custrecordous_quantityavailablebase: ' + locationData.quantityAvailableBase);
            
			log.audit('Field Set', 'custrecordous_lastinvtcountdate: ' + (locationData.lastInvtCountDate || 'null'));
			if(locationData.lastInvtCountDate){
				customRecord.setValue({
					fieldId: 'custrecordous_lastinvtcountdate',
					value: new Date(locationData.lastInvtCountDate)
				});
			}
            
            log.audit('Field Set', 'custrecordous_nextinvtcountdate: ' + (locationData.nextInvtCountDate || 'null'));
			if(locationData.nextInvtCountDate){
				customRecord.setValue({
					fieldId: 'custrecordous_nextinvtcountdate',
					value: new Date(locationData.nextInvtCountDate)
				});
			}
			
            
            
            
            customRecord.setValue({ fieldId: 'custrecordous_invtcountinterval', value: locationData.invtCountInterval });
           // log.debug('Field Set', 'custrecordous_invtcountinterval: ' + locationData.invtCountInterval);
            
            customRecord.setValue({ fieldId: 'custrecordous_invtclassification', value: locationData.invtClassification });
           // log.debug('Field Set', 'custrecordous_invtclassification: ' + locationData.invtClassification);

           // log.debug('Before Save', 'Item ID: ' + locationData.itemId + ', Location ID: ' + locationData.locationId + ', Last Count Date: ' + (locationData.lastInvtCountDate || 'null') + ', Next Count Date: ' + (locationData.nextInvtCountDate || 'null'));
            var customRecordId = customRecord.save();
           // log.debug('Custom Record Saved', 'Custom Record ID: ' + customRecordId + ' for Item ID: ' + locationData.itemId + (existingRecordId ? ' (Updated)' : ' (Created)'));
            
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