/**
 *@name: EXTEND SUITESCRIPT SDK - Offer Modal Controller
 *@description:
 * Client script that supoorts button on Sales Order. The script
 * checks if the items are protection plan items and calls a popup suitelet
 * for the user to select the appropriate protection plan.
 *
 *@copyright Extend, Inc.
 *@author Michael Draper
 *
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 *@NModuleScope Public
 */
define([
    'N/url',
    'N/runtime',
    'N/search',
    'N/currentRecord',
    '../lib/customscript_ext_util',
    '../lib/customscript_ext_config_lib',
    '../lib/customscript_ext_api_lib'
],
    function (url, runtime, search, currentRecord, EXTEND_UTIL, EXTEND_CONFIG, EXTEND_API) {
        var exports = {};
        exports.pageInit = function () {

        };
        exports.validateLine = function (context) {
            console.log('Validating Line', context);
            var objEventRouter = {
                'item': _handleItemInput
            }

            if (typeof objEventRouter[context.sublistId] !== 'function') {
                return true;
            }
            try {
                objEventRouter[context.sublistId](context);
            } catch (e) {

            }
            return true;
        };
        function _handleItemInput(context) {

            console.log('Handling Input', context);
            // console.log('Sublist', context.currentRecord.getCurrentSublistValue({ sublistId: context.sublistId }));
            var stExtendConfigRecId = runtime.getCurrentScript().getParameter('custscript_ext_config_rec_cs');
            console.log('config', 'getting.....');
            var objExtendConfig = EXTEND_CONFIG.getConfig(stExtendConfigRecId);
            console.log('config', objExtendConfig);

            var objCurrentRecord = context.currentRecord;
            var arrItemList = [];
            var stExtendItem = objExtendConfig.product_plan_item;

            var stItemId = objCurrentRecord.getCurrentSublistValue({
                sublistId: context.sublistId,
                fieldId: 'item'
            });
            console.log('stExtendItem', stExtendItem);
            console.log('stItemId', stItemId);
            if (stExtendItem == stItemId) {
                return;
            }
            // Lookup to item to see if it is eligible for warranty offers
            // VF 12/1/23 removing warranty check as boolean, changing to getOffers call
            var stLineNum = objCurrentRecord.getCurrentSublistIndex({
                sublistId: context.sublistId
            });
            var stItemName = objCurrentRecord.getCurrentSublistText({
                sublistId: context.sublistId,
                fieldId: 'item'
            });
            var intQty = objCurrentRecord.getCurrentSublistValue({
                sublistId: context.sublistId,
                fieldId: 'quantity'
            });
            var intPrice = parseInt(objCurrentRecord.getCurrentSublistValue({
                sublistId: context.sublistId,
                fieldId: 'rate'
            }) * 100);
            var stItemRefId = EXTEND_UTIL.getItemRefId(stItemId, objExtendConfig);
            var stItemCategory = EXTEND_UTIL.getItemCategory(stItemId, objExtendConfig);
 
            //call offers endpoint to see if product is warrantable
            var objResponse = EXTEND_API.getOffers(stItemRefId, objExtendConfig);
            var arrPlans = [];
            if (objResponse.code == 200) {
                var objResponseBody = JSON.parse(objResponse.body);
                log.debug('CS Check Warranty: Offers JSON Response', objResponseBody);
                var arrPlans = objResponseBody.plans.adh;
                log.debug('CS Check Warranty: arrPlans', arrPlans);
                if (!arrPlans) {
                    arrPlans = objResponseBody.plans.base;
                }
                log.debug('arrPlans', arrPlans);
            }
            //if no plans, product is assumed not warrantable
            if (arrPlans.length == 0) {
                return true;
            }

            var objItem = {};
            objItem.id = stItemId;
            objItem.name = stItemName;
            objItem.qty = intQty;
            objItem.line = stLineNum;
            objItem.refId = stItemRefId;
            objItem.price = intPrice;
            objItem.category = stItemCategory;
            //console.log('objItem', objItem);
            //push to array
            arrItemList.push(objItem);
            arrItemList = JSON.stringify(arrItemList);
            console.log('arrItemList', arrItemList);

            _callSuitelet(arrItemList, stItemId, stItemName, stLineNum, intQty, stItemRefId, intPrice, stItemCategory, stExtendConfigRecId);

            return true;
        }

        exports.openSuitelet = function (context) {
            console.log('Open Suitelet', context);

            var objCurrentRecord = currentRecord.get();
            //create item array
            var arrItemList = [];
            var stSublistId = 'item';
            var linecount = objCurrentRecord.getLineCount({
                sublistId: stSublistId
            });
            console.log('linecount', linecount);
            console.log('config', 'getting.....');
            var stExtendConfigRecId = runtime.getCurrentScript().getParameter('custscript_ext_config_rec_cs');
            var objExtendConfig = EXTEND_CONFIG.getConfig(stExtendConfigRecId);
            console.log('objExtendConfig', objExtendConfig);
            var stExtendItem = objExtendConfig.product_plan_item;
            //loop item sublist or retrieve for single line item if validate line function
            for (var i = 0; i < linecount; i++) {
                var stItemId = objCurrentRecord.getSublistValue({
                    sublistId: stSublistId,
                    fieldId: 'item',
                    line: i
                });

                var stItemRefId = EXTEND_UTIL.getItemRefId(stItemId, objExtendConfig);
                var stItemCategory = EXTEND_UTIL.getItemCategory(stItemId, objExtendConfig);
                var stItemName = objCurrentRecord.getSublistText({
                    sublistId: stSublistId,
                    fieldId: 'item',
                    line: i
                });
                var intQty = objCurrentRecord.getSublistText({
                    sublistId: stSublistId,
                    fieldId: 'quantity',
                    line: i
                });
                var intPrice = parseInt(objCurrentRecord.getSublistValue({
                    sublistId: stSublistId,
                    fieldId: 'rate',
                    line: i
                }) * 100);
                // Lookup to item to see if it is eligible for warranty offers
                /*
                var arrItemLookupField = search.lookupFields({
                    type: 'item',
                    id: stItemId,
                    columns: 'custitem_product_protection_item'
                });
               // var bIsWarranty = arrItemLookupField.custitem_ext_is_warrantable;
*/
                //  log.debug('Is warranty', typeof(bIsWarranty) + ', ' + bIsWarranty);

                /*
                    if (refIdValue) {
                        // Lookup to item to see if it is eligible for warranty offers
                        var arrItemLookup = search.lookupFields({
                            type: 'item',
                            id: stItemId,
                            columns: refIdValue
                        });
                        console.log('arrItemLookup', arrItemLookup)
                        for (var prop in arrItemLookup) {
                            var stItemRefId = arrItemLookup[prop];
                            if (!stItemRefId) {
                                var stItemRefId = arrItemLookup[prop][0].text;
                            }
    
                        var arrItemRefId = stItemRefId.split(": ");
                        console.log('arrItemRefId', arrItemRefId)
    
                        if (arrItemRefId.length > 1) {
                            stItemRefId = arrItemRefId[1]
                            console.log('stItemRefId', stItemRefId)
    
                        }
                        console.log('stItemRefId', stItemRefId)
    
                        break;
                    }
                }
    */
                var objItem = {};
                objItem.id = stItemId;
                objItem.name = stItemName;
                objItem.qty = intQty;
                objItem.line = i;
                objItem.refId = stItemRefId;
                objItem.price = intPrice;
                objItem.category = stItemCategory;

                //console.log('objItem', objItem);
                //push to array
                // If item is not a warranty item, return
                if (stExtendItem != stItemId) {
                    arrItemList.push(objItem);
                }
            }
            var stArrayItemList = JSON.stringify(arrItemList);
            console.log('stArrayItemList', stArrayItemList);
            _callSuitelet(stArrayItemList, arrItemList[0].id, arrItemList[0].name, arrItemList[0].line, arrItemList[0].qty, arrItemList[0].refId, arrItemList[0].price, arrItemList[0].category, stExtendConfigRecId);
        }
        function _callSuitelet(arrItemList, stItemId, stItemName, stLineNum, stItemQty, stItemRefId, intItemPrice, stItemCategory, objExtendConfig) {
            console.log('config', objExtendConfig);
            //Resolve suitelet URL
            var slUrl = url.resolveScript({
                scriptId: 'customscript_ext_offer_presentation_sl',
                deploymentId: 'customdeploy_ext_offer_presentation_sl',
                params: {
                    'itemid': stItemId,
                    'itemtext': stItemName,
                    'arrItemid': arrItemList,
                    'line': stLineNum,
                    'quantity': stItemQty,
                    'refid': stItemRefId,
                    'price': intItemPrice,
                    'category': stItemCategory,
                    'config': objExtendConfig,
                    // 'leadToken': stLeadToken
                }
            });
            console.log('slUrl', slUrl);
            //Call the pop up suitelet
            window.open(slUrl, '_blank', 'screenX=300,screenY=300,width=900,height=500,titlebar=0,status=no,menubar=no,resizable=0,scrollbars=0');

        }
        return exports;

    });