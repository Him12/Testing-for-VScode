/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: Staging Data Integration
 * Description: This script fetches data from the CSV file 'Book1.csv' in the file cabinet (folder ID 2777783),
 * compares item location data using a saved search 'customsearch_ous_location_data' for location names,
 * creates a JSON of locations from the item's locations sublist, uses it to populate location data fields,
 * performs calculations for matched locations, creates/updates custom records for staging data attached to the Staging Data subtab,
 * and removes custom records for locations not present in the updated saved search.
 * Uses native JavaScript for CSV parsing and includes detailed logging.
 * Updated to reset Staged Quantity and Net Available Qty to 0 before processing.
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
define(['N/file', 'N/record', 'N/search', 'N/runtime', 'N/format'], function(file, record, search, runtime, format) {
    
    // Helper function to format and validate date to MM/DD/YYYY
    function formatDateToString(dateValue) {
        if (!dateValue) {
            log.debug('Date Validation', 'Date value is null or empty: ' + dateValue);
            return null;
        }
        try {
            var dateObj = new Date(dateValue);
            if (isNaN(dateObj.getTime())) {
                log.error('Invalid Date Object', 'Date value is invalid: ' + dateValue);
                return null;
            }
            var year = dateObj.getFullYear();
            if (year < 2000 || year > 2030) {
                log.error('Date Out of Range', 'Date year ' + year + ' is outside valid range (2000-2030): ' + dateValue);
                return null;
            }
            var formattedDate = format.format({
                value: dateObj,
                type: format.Type.DATE,
                timezone: format.Timezone.AMERICA_NEW_YORK
            });
            var parsedDate = format.parse({
                value: formattedDate,
                type: format.Type.DATE
            });
            if (isNaN(parsedDate.getTime())) {
                log.error('Invalid Formatted Date', 'Formatted date is invalid: ' + formattedDate);
                return null;
            }
            var dateParts = formattedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!dateParts) {
                log.error('Invalid Date Format', 'Formatted date does not match MM/DD/YYYY: ' + formattedDate);
                return null;
            }
            log.debug('Formatted Date', 'Input: ' + dateValue + ', Output: ' + formattedDate);
            return formattedDate;
        } catch (e) {
            log.error('Date Processing Error', 'Failed to process date: ' + dateValue + ', Error: ' + e.message);
            return null;
        }
    }

    function getInputData() {
        try {
            // Reset Staged Quantity and Net Available Qty to 0 for all custom records
            var customRecordSearch = search.create({
                type: 'customrecord_ous__staging_data',
                filters: [],
                columns: ['internalid']
            });
            var searchResultCount = customRecordSearch.runPaged().count;
            log.debug('Custom Records Search for Reset', 'Found ' + searchResultCount + ' custom records to reset');

            customRecordSearch.run().each(function(result) {
                var recordId = result.getValue('internalid');
                try {
                    var customRecord = record.load({
                        type: 'customrecord_ous__staging_data',
                        id: recordId,
                        isDynamic: true
                    });
                    customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: 0 });
                    customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: 0 });
                    customRecord.save();
                    log.debug('Reset Record', 'Reset Staged Qty and Available Qty to 0 for Custom Record ID: ' + recordId);
                } catch (resetError) {
                    log.error('Reset Error', 'Failed to reset quantities for Custom Record ID: ' + recordId + ', Message: ' + resetError.message);
                }
                return true;
            });

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
            var itemLocationsMap = {};

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
                var locationName = rowData['LOCATION'];
                log.debug('Location Name in File', 'Item ID: ' + itemId + ', Location Name: ' + locationName);
                var netSuiteReduction = parseFloat(rowData['Staging Data']) || 0;

                if (itemId && locationName) {
                    if (!itemLocationsMap[itemId]) {
                        itemLocationsMap[itemId] = {
                            locations: [],
                            locationReductions: {}
                        };
                    }
                    itemLocationsMap[itemId].locations.push({
                        locationName: locationName,
                        netSuiteReduction: netSuiteReduction
                    });
                    var key = itemId + '_' + locationName;
                    itemLocationsMap[itemId].locationReductions[key] = netSuiteReduction;
                }
                log.debug('Parsed CSV Row', 'Row ' + i + ': ' + JSON.stringify(rowData));
            }

            for (var itemId in itemLocationsMap) {
                data.push({
                    itemId: itemId,
                    locations: itemLocationsMap[itemId].locations,
                    locationReductions: itemLocationsMap[itemId].locationReductions
                });
            }

            log.audit('Input Data Prepared', 'Total Items: ' + data.length);
            return data.length > 0 ? data : [{ 'itemId': '6585', 'locations': [], 'locationReductions': {} }];
        } catch (e) {
            log.error('GetInputData Error', 'Error in getInputData: ' + e.message + ', Stack: ' + e.stack);
            return [{ 'itemId': '6585', 'locations': [], 'locationReductions': {} }];
        }
    }
    
    function map(context) {
        try {
            var itemData = JSON.parse(context.value);
            log.debug('Map Start', 'Processing Item Data: ' + JSON.stringify(itemData));

            var itemId = itemData.itemId;
            var locations = itemData.locations;
            var locationReductions = itemData.locationReductions;

            if (!itemId || !locations || locations.length === 0) {
                log.error('Invalid Item Data', 'Item missing ID or locations: ' + JSON.stringify(itemData));
                return;
            }

            log.debug('Data Extracted', 'Item ID: ' + itemId + ', Locations: ' + JSON.stringify(locations));

            var itemRecord = record.load({
                type: record.Type.INVENTORY_ITEM,
                id: itemId,
                isDynamic: false
            });

            var lineCount = itemRecord.getLineCount({ sublistId: 'locations' });
            log.debug('Location Check', 'Item ID: ' + itemId + ', Location sublist lines: ' + lineCount);

            var itemLocationsMap = {};
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

                var lastInvtCountDate = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'lastinvtcountdate',
                    line: j
                });
                var nextInvtCountDate = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'nextinvtcountdate',
                    line: j
                });

                var formattedLastInvtCountDate = formatDateToString(lastInvtCountDate);
                var formattedNextInvtCountDate = formatDateToString(nextInvtCountDate);

                log.debug('Raw and Formatted Dates', 'Item ID: ' + itemId + ', Location ID: ' + locId + 
                    ', Raw Last Count Date: ' + (lastInvtCountDate || 'null') + 
                    ', Formatted Last Count Date: ' + (formattedLastInvtCountDate || 'null') + 
                    ', Raw Next Count Date: ' + (nextInvtCountDate || 'null') + 
                    ', Formatted Next Count Date: ' + (formattedNextInvtCountDate || 'null'));

                try {
                    itemLocationsMap[locId] = {
                        locationId: locId,
                        locationName: locationName,
                        onHand: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityonhand', line: j }) || 0).toFixed(2)),
                        available: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityavailable', line: j }) || 0).toFixed(2)),
                        onOrder: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityonorder', line: j }) || 0).toFixed(2)),
                        committed: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantitycommitted', line: j }) || 0).toFixed(2)),
                        backOrdered: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantitybackordered', line: j }) || 0).toFixed(2)),
                        inTransit: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityintransit', line: j }) || 0).toFixed(2)),
                        reorderPoint: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'savedreorderpoint', line: j }) || 0).toFixed(2)),
                        preferredStockLevel: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'preferredstocklevel', line: j }) || 0).toFixed(2)),
                        stockUnit: itemRecord.getValue({ fieldId: 'stockunit' }) || '',
                        value: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'onhandvaluemli', line: j }) || 0).toFixed(2)),
                        averageCost: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'averagecostmli', line: j }) || 0).toFixed(2)),
                        lastPurchasePrice: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'lastpurchasepricekey', line: j }) || 0).toFixed(2)),
                        leadTime: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'leadtime', line: j }) || 0).toFixed(2)),
                        safetyStockLevel: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'safetystocklevel', line: j }) || 0).toFixed(2)),
                        defaultReturnCost: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'defaultreturncost', line: j }) || 0).toFixed(2)),
                        quantityAvailableBase: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityavailablebase', line: j }) || 0).toFixed(2)),
                        lastInvtCountDate: formattedLastInvtCountDate,
                        nextInvtCountDate: formattedNextInvtCountDate,
                        invtCountInterval: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'invtcountinterval', line: j }) || 0).toFixed(2)),
                        invtClassification: itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'invtclassification', line: j }) || ''
                    };
                } catch (e) {
                    log.error('Error Building itemLocationsMap', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Error: ' + e.message + ', Stack: ' + e.stack);
                    continue;
                }
            }
            log.debug('Item Locations JSON', 'Item ID: ' + itemId + ', Locations Map: ' + JSON.stringify(itemLocationsMap));

            if (lineCount === 0) {
                log.error('No Locations', 'No locations found for Item ID: ' + itemId);
                return;
            }

            var locationSearch = search.load({
                id: 'customsearch_ous_location_data'
            });
            var locationResults = locationSearch.run().getRange({ start: 0, end: 1000 });
            log.debug('Location Search Results', 'Number of results: ' + locationResults.length);
            var locationMap = {};
            if (locationResults.length === 0) {
                log.error('Empty Search Results', 'Saved search customsearch_ous_location_data returned no results. Please verify the search configuration.');
            } else {
                locationResults.forEach(function(result) {
                    var locId = result.getValue({ name: 'internalid' });
                    var locName = result.getValue({ name: 'formulatext' });
                    if (locId && locName) {
                        locationMap[locName] = parseInt(locId, 10);
                        log.debug('Mapped Location', 'Location Name: ' + locName + ', Internal ID: ' + locId);
                    } else {
                        log.debug('Invalid Mapping', 'Loc ID: ' + locId + ', Loc Name: ' + locName);
                    }
                });
            }
            log.debug('JSON Created', 'Location Map: ' + JSON.stringify(locationMap));

            var batchSize = 20;
            var usage = runtime.getCurrentScript().getRemainingUsage();
            log.debug('Initial Governance Usage', 'Remaining Units: ' + usage);

            locations.forEach(function(csvLocation) {
                var csvLocationName = csvLocation.locationName;
                var netSuiteReduction = csvLocation.netSuiteReduction;

                var matchedLocId = locationMap[csvLocationName];
                if (!matchedLocId) {
                    for (var locName in locationMap) {
                        if (locName.toLowerCase() === csvLocationName.toLowerCase()) {
                            matchedLocId = locationMap[locName];
                            log.debug('Exact Case-Insensitive Match Found', 'CSV Location Name: ' + csvLocationName + ', Matched Location Name: ' + locName + ', Matched Location ID: ' + matchedLocId);
                            break;
                        }
                        if (locName.includes(csvLocationName) || (csvLocationName.match(/\d+/) && locName.includes(csvLocationName.match(/\d+/)[0]))) {
                            matchedLocId = locationMap[locName];
                            log.debug('Partial Match Found', 'CSV Location Name: ' + csvLocationName + ', Matched Location Name: ' + locName + ', Matched Location ID: ' + matchedLocId);
                            break;
                        }
                    }
                }
                log.debug('Location Name Found from File', 'CSV Location Name: ' + csvLocationName + ', Matched Location ID: ' + (matchedLocId || 'none'));

                if (!matchedLocId) {
                    log.error('Location Not Found', 'No matching location ID found for name: ' + csvLocationName);
                    return;
                }
                log.debug('Location Internal ID Found', 'Using Location ID: ' + matchedLocId + ' for Item ID: ' + itemId);

                var lineIndex = -1;
                for (var j = 0; j < lineCount; j++) {
                    var locId = itemRecord.getSublistValue({
                        sublistId: 'locations',
                        fieldId: 'location',
                        line: j
                    });
                    if (parseInt(locId, 10) === matchedLocId) {
                        lineIndex = j;
                        break;
                    }
                }

                if (lineIndex === -1) {
                    log.error('Sublist Location Not Found', 'No sublist entry found for Location ID: ' + matchedLocId + ' for Item ID: ' + itemId);
                    return;
                }

                var locId = matchedLocId;
                var locationName = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'locationname',
                    line: lineIndex
                }) || locId;
                log.debug('Processing Location', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ' at line ' + lineIndex);

                if (processedLocations.indexOf(locId) === -1) {
                    log.debug('Skipped Location', 'Location ID: ' + locId + ', Name: ' + locationName + ' was not in initial sublist scan for Item ID: ' + itemId);
                    return;
                }

                var locationData = itemLocationsMap[locId];
                if (!locationData) {
                    log.debug('No Location Data', 'No data found in itemLocationsMap for Location ID: ' + locId);
                    return;
                }

                var isCsvMatch = true;
                var locationKey = itemId + '_' + csvLocationName;
                var reduction = locationReductions[locationKey] || 0;

                log.debug('Location Data', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Is CSV Match: ' + isCsvMatch + ', NetSuite Reduction: ' + reduction);

                locationData.itemId = itemId;
                locationData.netSuiteReduction = Number((reduction || 0).toFixed(2));
                locationData.isCsvMatch = isCsvMatch;

                if (isCsvMatch && reduction > 0) {
                    locationData.stagedQty = Number((reduction).toFixed(2));
                    locationData.availableQty = Number((locationData.onHand - locationData.stagedQty).toFixed(2));
                } else {
                    locationData.stagedQty = 0.00;
                    locationData.availableQty = 0.00;
                    log.debug('Skipped Calculation', 'No calculations for non-matching location ID: ' + locId + ', Name: ' + locationName);
                }

                log.debug('Calculated Quantities', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ', Staged Quantity: ' + locationData.stagedQty + ', Available Quantity: ' + locationData.availableQty);
                log.audit('Before Write', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Last Count Date: ' + (locationData.lastInvtCountDate || 'null') + ', Next Count Date: ' + (locationData.nextInvtCountDate || 'null'));

                usage = runtime.getCurrentScript().getRemainingUsage();
                if (usage < 500) {
                    log.debug('Governance Warning', 'Remaining Units: ' + usage + '. Yielding for Location ID: ' + locId);
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
            });
            log.debug('Map Completed', 'Processed all locations for Item ID: ' + itemId);
        } catch (e) {
            log.error('Map Error', 'Error processing Item ID: ' + (itemData ? itemData.itemId : 'unknown') + ', Message: ' + e.message + ', Stack: ' + e.stack);
        }
    }
    
    function reduce(context) {
        try {
            var keyParts = context.key.split('_');
            var itemId = keyParts[0];
            var locationId = keyParts[1];
            var locationData = JSON.parse(context.values[0]);
            log.debug('Reduce Start', 'Processing Item ID: ' + itemId + ', Location ID: ' + locationId + ' (from key), Data: ' + JSON.stringify(locationData));

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
                
                if (locationData.isCsvMatch) {
                    var fieldsToCompare = [
                        { standard: 'onHand', custom: 'custrecordous_on_hand', type: 'number' },
                        { standard: 'available', custom: 'custrecordous_available', type: 'number' },
                        { standard: 'onOrder', custom: 'custrecordous_on_order', type: 'number' },
                        { standard: 'committed', custom: 'custrecordous_committed', type: 'number' },
                        { standard: 'backOrdered', custom: 'custrecordous_back_ordered', type: 'number' },
                        { standard: 'inTransit', custom: 'custrecordous_in_transit', type: 'number' },
                        { standard: 'reorderPoint', custom: 'custrecordous_reorder_point', type: 'number' },
                        { standard: 'preferredStockLevel', custom: 'custrecordous_pref_stock_level', type: 'number' },
                        { standard: 'value', custom: 'custrecordous_value', type: 'number' },
                        { standard: 'averageCost', custom: 'custrecordous_averagecostmli', type: 'number' },
                        { standard: 'lastPurchasePrice', custom: 'custrecordous_lastpurchasepricekey', type: 'number' },
                        { standard: 'leadTime', custom: 'custrecordous_leadtime', type: 'number' },
                        { standard: 'safetyStockLevel', custom: 'custrecordous_safetystocklevel', type: 'number' },
                        { standard: 'defaultReturnCost', custom: 'custrecordous_defaultreturncost', type: 'number' },
                        { standard: 'quantityAvailableBase', custom: 'custrecordous_quantityavailablebase', type: 'number' },
                        { standard: 'invtCountInterval', custom: 'custrecordous_invtcountinterval', type: 'number' },
                        { standard: 'stockUnit', custom: 'custrecordous_stock_unit', type: 'string' },
                        { standard: 'invtClassification', custom: 'custrecordous_invtclassification', type: 'string' },
                        { standard: 'lastInvtCountDate', custom: 'custrecordous_lastinvtcountdate', type: 'date' },
                        { standard: 'nextInvtCountDate', custom: 'custrecordous_nextinvtcountdate', type: 'date' }
                    ];

                    fieldsToCompare.forEach(function(field) {
                        var standardValue = locationData[field.standard];
                        var customValue = customRecord.getValue({ fieldId: field.custom });
                        var shouldUpdate = false;

                        if (field.type === 'number') {
                            standardValue = Number(standardValue) || 0;
                            customValue = Number(customValue) || 0;
                            shouldUpdate = standardValue.toFixed(2) !== customValue.toFixed(2);
                        } else if (field.type === 'date') {
                            shouldUpdate = (standardValue || '') !== (customValue || '');
                        } else {
                            shouldUpdate = (standardValue || '') !== (customValue || '');
                        }

                        if (shouldUpdate) {
                            log.debug('Updating Field', 'Field: ' + field.custom + ', Old Value: ' + customValue + ', New Value: ' + standardValue);
                            if (field.type === 'date') {
                                customRecord.setText({ fieldId: field.custom, text: standardValue || null });
                            } else {
                                customRecord.setValue({ fieldId: field.custom, value: standardValue || (field.type === 'number' ? 0 : '') });
                            }
                        } else {
                            log.debug('Field Unchanged', 'Field: ' + field.custom + ', Value: ' + customValue);
                        }
                    });
                }
            } else {
                customRecord = record.create({
                    type: 'customrecord_ous__staging_data',
                    isDynamic: true
                });
                log.debug('Creating New Record', 'Creating new custom record for Item ID: ' + itemId + ', Location ID: ' + locationId);
                customRecord.setValue({ fieldId: 'custrecordous_location', value: locationId });
                customRecord.setValue({ fieldId: 'custrecordous_item_link', value: itemId });
                customRecord.setValue({ fieldId: 'custrecordous_on_hand', value: locationData.onHand || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: locationData.stagedQty || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: locationData.availableQty || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_on_order', value: locationData.onOrder || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_committed', value: locationData.committed || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_available', value: locationData.available || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_back_ordered', value: locationData.backOrdered || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_in_transit', value: locationData.inTransit || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_reorder_point', value: locationData.reorderPoint || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_pref_stock_level', value: locationData.preferredStockLevel || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_stock_unit', value: locationData.stockUnit || '' });
                customRecord.setValue({ fieldId: 'custrecordous_value', value: locationData.value || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_averagecostmli', value: locationData.averageCost || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_lastpurchasepricekey', value: locationData.lastPurchasePrice || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_leadtime', value: locationData.leadTime || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_safetystocklevel', value: locationData.safetyStockLevel || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_defaultreturncost', value: locationData.defaultReturnCost || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_quantityavailablebase', value: locationData.quantityAvailableBase || 0 });

                log.debug('Setting Date Fields', 'Item ID: ' + itemId + ', Location ID: ' + locationId + 
                    ', Last Count Date: ' + (locationData.lastInvtCountDate || 'null') + 
                    ', Next Count Date: ' + (locationData.nextInvtCountDate || 'null'));

                customRecord.setText({ fieldId: 'custrecordous_lastinvtcountdate', text: locationData.lastInvtCountDate || null });
                customRecord.setText({ fieldId: 'custrecordous_nextinvtcountdate', text: locationData.nextInvtCountDate || null });
                customRecord.setValue({ fieldId: 'custrecordous_invtcountinterval', value: locationData.invtCountInterval || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_invtclassification', value: locationData.invtClassification || '' });
            }
            
            log.debug('Setting Staged Qty', 'Value: ' + locationData.stagedQty);
            customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: locationData.stagedQty || 0 });
            log.debug('Setting Available Qty', 'Value: ' + locationData.availableQty);
            customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: locationData.availableQty || 0 });
            log.debug('Setting NetSuite Reduction', 'Value: ' + locationData.netSuiteReduction);
            customRecord.setValue({ fieldId: 'custrecordous_net_suite_reduction', value: locationData.netSuiteReduction || 0 });

            try {
                var customRecordId = customRecord.save();
                log.debug('Record Saved', 'Custom Record ID: ' + customRecordId + ', Staged Qty: ' + customRecord.getValue({ fieldId: 'custrecordous_staged_qty' }) + ', Available Qty: ' + customRecord.getValue({ fieldId: 'custrecordous_available_qty' }));
            } catch (saveError) {
                log.error('Save Error', 'Failed to save custom record for Item ID: ' + itemId + ', Location ID: ' + locationId + ', Message: ' + saveError.message + ', Stack: ' + saveError.stack);
            }
            
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

            try {
                var locationSearch = search.load({
                    id: 'customsearch_ous_location_data'
                });
                var locationResults = locationSearch.run().getRange({ start: 0, end: 1000 });
                var validLocationIds = locationResults.map(function(result) {
                    return parseInt(result.getValue({ name: 'internalid' }), 10);
                });
                log.debug('Valid Locations', 'Valid Location IDs from saved search: ' + JSON.stringify(validLocationIds));

                var allCustomRecordsSearch = search.create({
                    type: 'customrecord_ous__staging_data',
                    filters: [
                        ['custrecordous_item_link', 'is', itemId]
                    ],
                    columns: [
                        'internalid',
                        'custrecordous_location'
                    ]
                });

                var recordsToDelete = [];
                var searchResultCount = allCustomRecordsSearch.runPaged().count;
                log.debug('Custom Records Search', 'Found ' + searchResultCount + ' custom records for Item ID: ' + itemId);

                allCustomRecordsSearch.run().each(function(result) {
                    var recordId = result.getValue('internalid');
                    var locId = parseInt(result.getValue('custrecordous_location'), 10);
                    if (validLocationIds.indexOf(locId) === -1 && recordId !== customRecordId) {
                        recordsToDelete.push(recordId);
                        log.debug('Record to Delete', 'Custom Record ID: ' + recordId + ', Location ID: ' + locId + ' not in saved search');
                    }
                    return true;
                });

                var deleteBatchSize = 10;
                for (var i = 0; i < recordsToDelete.length; i += deleteBatchSize) {
                    var usage = runtime.getCurrentScript().getRemainingUsage();
                    if (usage < 500) {
                        log.debug('Governance Warning', 'Remaining Units: ' + usage + '. Yielding before deleting batch starting at index ' + i);
                        return;
                    }
                    var batch = recordsToDelete.slice(i, i + deleteBatchSize);
                    batch.forEach(function(recordId) {
                        try {
                            record.delete({
                                type: 'customrecord_ous__staging_data',
                                id: recordId
                            });
                            log.audit('Record Deleted', 'Deleted custom record ID: ' + recordId + ' for Item ID: ' + itemId + ' as its location is not in saved search');
                        } catch (deleteError) {
                            log.error('Delete Error', 'Failed to delete custom record ID: ' + recordId + ' for Item ID: ' + itemId + ', Message: ' + deleteError.message + ', Stack: ' + deleteError.stack);
                        }
                    });
                    log.debug('Deletion Batch Completed', 'Processed deletion batch from index ' + i + ' to ' + (i + batch.length - 1));
                }
            } catch (deleteProcessError) {
                log.error('Delete Process Error', 'Error processing deletion of invalid custom records for Item ID: ' + itemId + ', Message: ' + deleteProcessError.message + ', Stack: ' + deleteProcessError.stack);
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
            
            log.audit('Summary', 'Processing completed. Total items processed: ' + (summary.inputSummary.total || 0));
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