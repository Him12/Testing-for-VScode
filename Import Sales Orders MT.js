/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope Public
 * @NAmdConfig  /SuiteScripts/Source/Libs/helperConfig.json
 * 
 * 		Name                            Date                              Reason
 *  Yogesh Bhurley                   12/08/2024          For restrictng the script to exclude Imcorp subsidiary
 *
 ********************************************************************************************************************************/
 

define(["./osm_sales_order_helper", 'N/record', "N/search", "N/format",
    "formSelector", "dmHelper", "searchHelper", "sublistHelper", "errorHelper", "cHelper", "emailHelper", "moment", "errorCodes", "N/runtime",
    "ramda", "N/log"],
// define(['N/record', "N/search", "N/format", "formSelector", "dmHelper", "searchHelper", "sublistHelper", "errorHelper", "cHelper", "emailHelper", "moment", "errorCodes"],
function (invHelp, record, search, format, fh, dmHelper, sHelper, suHelper, eHelper, cHelper, emailHelper, moment, eCodes, runtime, ramda, log)
{
    var itemsJSON = [];
    // var memberItemsJSON = [];
    // var uomJSON = [];
    var customerJSON = [];
    var estimateJSON = [];
    var specialItemsJSON = [];
    var acctPeriodJSON = [];
    var g_lookupVals = new Object();
    var g_subj = 'Inventory Adjustment Alert';
    var g_header = invHelp.emailHeaderString();  //Get's the style and header.
    var g_message = "";  //Get's the style and header.
    var g_emailTo;// ["070843", "037648", "033687", "033466"];

    var g_salesOrdId = null;
    var governance = 0;
    var g_lat;
    var g_long;
    var g_fullJson = "";
    var g_minGovRequired = 190;

    /**
     * Add's to the global governance variable
     * @param number Amount to increase governance
     */
    function addGov(number)
    {
        governance += number;
    }

    /**
     * Get's the correct Internal ID's of the values passed in.
     * @param salesOrdMT
     * @returns {{subsidiary: string, territory: string, serviceCode: string, entityStatus: string, customer: string}}
     */
    function getLookupValues(salesOrdMT)
    {
        var estimateObj = "", customer = "", subsidiary = "", servCode = "";

        //Format the values to upper case and trimmed.
        var estimate = dmHelper.formatValue(salesOrdMT["JobNumber"]);

        var customerId = dmHelper.formatValue(salesOrdMT["CustId"]);

        //Get's the Estimate Details for specific Job.
        estimateJSON.some(function (elem)
        {
            var condition = dmHelper.formatValue(elem["entityid"]) == estimate && dmHelper.formatValue(elem["customerId"]) == customerId;
            estimateObj = condition ? elem : null;
            return condition;
        });

        //Get Customer and Subsidiary on Sales Order.
        customerJSON.some(function (elem)
        {
            // log.debug("elem", elem["entityid"] + " == " + customerId);
            customer = elem["entityid"] == customerId ? elem : null;
            subsidiary = elem["subsidiary"]; // formatValue(elem.subsidiaryName) == sub ? elem : null;
            return elem["entityid"] == customerId;
        });

        return {
            subsidiary: subsidiary,
            customer: customer["internalid"],
            groupInvoices: customer["groupinvoices"],
            estimate: estimateObj
        };
    }

    /**
     * Checks to see if the Sales Order Exists by looking it up by Unique ID passed in.
     * @param uniqueId
     * @returns {*}
     */
    function checkIfSOExists(uniqueId)
    {
        if (uniqueId)
        {
            var so = null;
            var salesOrderText = "";

            var columns = ["tranid", "custbody_sales_order_unique_id"];
            var filters = [["custbody_sales_order_unique_id", "is", uniqueId], "and", ["mainline", "is", "true"], "and", ["subsidiary", "noneof", "44"]];//Subsidiary added to exclude imcorp subsidiary
            var uniqueIDsCheck = sHelper.getSearchResultsObj("salesorder", columns, filters);
            //If Unique ID Exists, return error.
            if (uniqueIDsCheck.length >= 1)
            {
                var message = "Unique ID " + uniqueId + " already exists on Sales Order " + uniqueIDsCheck[0]["tranid"];
                eCodes.UNIQUE_ID_ERROR["message"] = message;
                throw eCodes.UNIQUE_ID_ERROR;
                // throw {name:"UNIQUE_ID_ERROR", message: message}
            }
            return so;
        }

        return null;
    }

    /**
     * Loads and returns a sales order by the sales order unique ID
     * @param uniqueId
     * @returns sales order
     */
    function loadSO(uniqueId)
    {
        // check for valid sales order ID then search to see if exist, load and return
        if (uniqueId)
        {
            var salesOrder = null;
            var columns = ["tranid", "custbody_sales_order_unique_id", "internalid"];
            var filters = [["custbody_sales_order_unique_id", "is", uniqueId], "and", ["mainline", "is", "true"], "and", ["subsidiary", "noneof", "44"]];  //Subsidiary added to exclude imcorp subsidiary

            var response = new sHelper.Search("salesorder", columns, filters).firstOrDefault();
            if (response != null)
            {
                salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: response.internalid,
                    isDynamic: true
                });
                // log.debug("LoadSO after record load: id", salesOrder.id);
                g_salesOrdId = salesOrder.id;
            }

            return salesOrder;
        }
    }

    /**
     * Get's the specific item from an Estimate and Job Number.
     * @param columnName JSON Column
     * @param itemNo
     * @param jobNumber
     * @returns {null}
     */
    function getEstimate(columnName, itemNo, jobNumber)
    {
        if (itemNo)
        {
            var item = null;

            estimateJSON.some(function (elem)
            {
                var condition = elem[columnName].formatValue() == itemNo.formatValue() && elem["entityid"] == jobNumber;
                item = condition ? elem : null;
                return condition;
            });
            return item;
        }

        return null;
    }

    /**
     * Adds the Sales Order with the Item's passed in that are also on the Estimate.
     * @param salesOrd Sales Order
     * @param sublistId Sublist Id
     * @param itemId Item to add
     * @param item
     * @param estimate Estimate ID
     * @param rate
     * @param totalAmt
     * @param i The line to put the item on.
     * @returns {*}
     */
    function addItemToSalesOrder(salesOrd, sublistId, itemId, item, estimate, rate, totalAmt)
    {
        salesOrd.selectNewLine({
            sublistId: sublistId
        });

        g_lat = item["Lat"];
        g_long = item["Long"];
        // log.debug("item[\"PrintZeroDollarItem\"]", item["PrintZeroDollarItem"]);
        var printZeroDollarItem = dmHelper.parseBool((item["PrintZeroDollarItem"]));
        // log.debug("printZeroDollarItem", printZeroDollarItem);

        suHelper.setCurrentSublistValue(salesOrd, sublistId, "item", itemId);
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "price", "-1");

        //if lat and long, set the ship address to empty.
        if ((!dmHelper.isNullOrEmpty(g_lat) && g_lat != 0) && (!dmHelper.isNullOrEmpty(g_long) && g_long != 0))
        {
            suHelper.setCurrentSublistValue(salesOrd, sublistId, "shipaddress", "");
        }
        else
        {
            throw eCodes.INVALID_LAT_LONG_ERROR;
        }

        // suHelper.setCurrentSublistValue(salesOrd, sublistId, "shipaddress", "");
        // suHelper.setSublistValue(salesOrd, sublistId, "taxcode_display", "AVATAX");
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "custcol_ava_shipto_longitude", g_long);
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "custcol_ava_shipto_latitude", g_lat);
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "quantity", parseFloat(item["Quantity"]));
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "description", estimate["memo"]);
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "rate", parseFloat(rate));
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "custcol_osm_item_total_price", parseFloat(totalAmt));
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "custcol_osm_print_zero_dollar_item", printZeroDollarItem);

        //finalizes the row and adds it.
        salesOrd.commitLine({sublistId: sublistId});
        return salesOrd;
    }

    //#region - Add Special Items -
    /**
     * Adds a SubTotal/Discount/Retention Item.
     * @param salesOrd
     * @param sublistId
     * @param item
     * @param {boolean} isDiscOrRet is discount or retention
     * @returns {*}
     */
    function addSpecialItem(salesOrd, sublistId, item, isDiscOrRet)
    {
        salesOrd.selectNewLine({
            sublistId: sublistId
        });
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "item", item["itemId"]);
        suHelper.setCurrentSublistValue(salesOrd, sublistId, "quantity", 1);
        if (isDiscOrRet)
        {
            suHelper.setCurrentSublistValue(salesOrd, sublistId, "custcol_ava_shipto_longitude", g_long);
            suHelper.setCurrentSublistValue(salesOrd, sublistId, "custcol_ava_shipto_latitude", g_lat);
        }
        salesOrd.commitLine({sublistId: sublistId});
        return salesOrd;
    }

    /**
     * Get's the proper Retention/Discount item and adds it to the Sales Order.
     * @param salesOrd
     * @param rate
     * @param useRetention True for retention, false for Discount
     * @returns {*}
     */
    function createEstimateSpecialItemLine(salesOrd, rate, useRetention)
    {
        var sublistId = "item";
        var item = {};

        // Gets the proper special item for discounts and retentions.
        var dmHelperFormatRate = null;
        /* OLD CODE REPLACED AS OF 1/5/2024
        specialItemsJSON.some(function (elem)
        {
            dmHelperFormatRate = dmHelper.formatValue(elem.rate);
            var condition = dmHelperFormatRate == rate && elem["retentionItem"] == useRetention;
            item = condition ? elem : null;
            return condition;
        });
        NEW CODE FOLLOWS  */
        var item = null;
        for (var i = 0; i < specialItemsJSON.length; i++) {
           var specialItemRate = pnvl(specialItemsJSON[i].rate, true);
           var passedRate = pnvl(rate, true);
           if(specialItemRate == passedRate && specialItemsJSON[i].retentionItem == useRetention) {
               dmHelperFormatRate = specialItemRate;
               item = specialItemsJSON[i];
               break;
           }
        }

        // check for item null - then it never matched rate on estimate against configured special retention rates in NS
        if (item === null)
        {
            var estimate = g_lookupVals["estimate"];
            var estimateName = estimate["tranid"];
            var retentionOrDiscount = useRetention ? "Retention rate" : "Discount rate";
            log.error("SalesOrderImport createEstimateSpecialItemLine()", "rate passed in: " + rate + " / dmHelper-elem.rate: " + dmHelperFormatRate);
            log.error("SalesOrderImport createEstimateSpecialItemLine()", 'The ' + retentionOrDiscount + ' on the estimate <' + estimateName + '> of ' + rate + ' does not match any defined special Items in NetSuite. Special Items' + JSON.stringify(specialItemsJSON))
        }
      
        //Add the special item to the Sales Order.
        return addSpecialItem(salesOrd, sublistId, item, true);
    }

    /**
     * Adds a SubTotal item to the Sales Order.
     * @param salesOrd
     * @returns {*}
     */
    function createEstimateSubTotalItem(salesOrd)
    {
        var sublistId = "item";
        var item = "";

        specialItemsJSON.some(function (elem)
        {
            var condition = elem.subTotalItem == true;
            item = condition ? elem : null;
            return condition;
        });

        //Adds the subtotal item to the Sales Order.
        return addSpecialItem(salesOrd, sublistId, item, false);
    }

    /**
     * Adds the Sub Total, Retention, and Discounted Items as needed.
     * @param salesOrdMT Data passed into service
     * @param salesOrder Estimate that is being created
     * @returns SalesOrder
     */
    function addSpecialItems(salesOrder)
    {
        var estimate = g_lookupVals["estimate"];
        //Calculates and reformats the retention rate
        var retention = parseFloat(format.parse({
            value: estimate["retentionRate"] || 0,
            type: format.Type.PERCENT
        })) * 100;
        // If a float, set to 1 digit precision, if whole number, leave alone
        if (retention > 0)
        {
            if (dmHelper.isFloat(retention))
            {
                retention = retention.toFixed(1);
            }
        }

        //Calculates and reformats the retention rate
        var discount = parseFloat(format.parse({
            value: estimate["discountRate"] || 0,
            type: format.Type.PERCENT
        })) * 100;

        //Add Subtotal if it has a retention or discounted rate.
        if (retention > 0 || discount > 0)
        {
            salesOrder = createEstimateSubTotalItem(salesOrder);
        }

        //if retention, add proper retention item.
        if (retention && retention > 0)
        {
            salesOrder = createEstimateSpecialItemLine(salesOrder, retention, true);
        }
        //if discount, add proper discount item.
        if (discount && discount > 0)
        {
            salesOrder = createEstimateSpecialItemLine(salesOrder, discount, false);
        }
        return salesOrder;
    }

    //#endregion - Add Special Items -

    /**
     * Synces the Sales Order lines to match that of the Estimate.
     * @param {JSON} salesOrdMT
     * @param {SalesOrder} salesOrd
     * @returns SalesOrder
     */
    function syncLineItems(salesOrdMT, salesOrd)
    {
        var sublistId = "item";
        var items = salesOrdMT["OrderLines"];
        var jobNumber = salesOrdMT["JobNumber"];

        var count = salesOrd.getLineCount({
            sublistId: sublistId
        });

        //Remove all items from the Sales Order that were on the Estimate (Will be added in later).
        for (var i = count - 1; i >= 0; i--)
        {
            salesOrd.selectLine({
                sublistId: sublistId,
                line: i
            });
            salesOrd.removeLine({sublistId: sublistId, line: i});
        }

        //Get's all items and IDs sent in from JSON and DB.
        var myItems = sHelper.filterSearchResults(estimateJSON, "entityid", jobNumber);

        //Add Items to the Sales Order.
        for (var i = 0; i < items.length; i++)
        {
            var item = items[i];
            var itemNo = item["ProductId"];
            var estimate = null;

            //This will get the item on the estimate.
            var exists = myItems.some(function (elem)
            {
                if (item["ProductId"] == elem["itemid"])
                {
                    estimate = getEstimate("itemid", elem["itemid"], jobNumber);
                }
                //This was here before this method was redone. Leaving it since this script has passed all tests, and I do not want to change it before release.
                if (estimate)
                {
                    var condition = itemNo.formatValue() == itemNo.formatValue();
                    return condition;
                }
                else
                {
                    //If the item wasn't found, loop through the next item.
                    return false;
                }
            });

            //If the item passed in on the Invoice was on the Estimate, add it to the Sales Order.
            //TODO: Throw error if item passed in, but not on estimate?
            if (exists)
            {
                //Get's the current item's ID and extra information not passed in.
                var prod = sHelper.getObjFromSearchResults(itemsJSON, "itemid", item["ProductId"]);

                if (prod)
                {
                    var itemType = prod["type"].formatValue();
                    var itemId = prod["internalid"];
                    var kitItemId = prod["custitem_osm_service_for_sale_item"];
                    var matOnly = prod["custitemosm_material_only"];
                    var rate = 0;
                    var totalAmt = 0;

                    // setting to numbers because with some KITs the comparison against rate is failing
                    var totalMatCost = parseFloat(estimate["custcol_osm_material_cost_per_item"] || 0);
                    rate = parseFloat(estimate["rate"] || 0);

                    //Use rates based on below criteria.
                    if (itemType == "KIT")
                    {
                        //if not material only.
                        if (!matOnly)
                        {
                            if (rate > totalMatCost)
                            {
                                rate = totalMatCost;
                            }
                            totalAmt = estimate["rate"] || 0;
                        }
                        else
                        {
                            rate = estimate["rate"] || 0;
                            totalAmt = estimate["rate"] || 0;
                        }
                    }
                    else if (itemType == "SERVICE")
                    {
                        rate = estimate["rate"] || 0;
                        totalAmt = rate;
                    }

                    //Add the item to the Sales Order.
                    addItemToSalesOrder(salesOrd, sublistId, itemId, item, estimate, rate, totalAmt);

                    //If it is a Kit and not material only, add the 7L item associated with it.
                    if (kitItemId && itemType == "KIT" && !matOnly)
                    {
                        // log.debug("Inside 7L", "currentRate: " + rate + " originalRate: " + estimate["rate"] + " totalMatCost: " + totalMatCost);
                        rate = parseFloat(estimate["rate"]);  // reset rate to original and make a number for 7L item
                        if (rate >= totalMatCost)
                        {
                            rate = rate - totalMatCost;
                        }
                        else
                        {
                            rate = 0;
                        }
                        addItemToSalesOrder(salesOrd, sublistId, kitItemId, item, estimate, rate, 0);
                    }
                }
            }
        }

        //If needed, add the special items (subtotal/discount/retention)
        if (salesOrd.getLineCount("item") >= 1)
        {
            salesOrd = addSpecialItems(salesOrd);
        }

        return salesOrd;
    }

    function getPostingPeriod()
    {
        var date;
        var todaysDate = moment();
        for (var i = 0; i < acctPeriodJSON.length; i++)
        {
            var acctPeriod = acctPeriodJSON[i];
            date = moment(acctPeriod["enddate"]).toDate();
        }

        if (todaysDate.isSameOrBefore(date))
        {
            date = todaysDate;
        }
        return date;
    }

    function HTMLEncode(str)
    {
        var i = str.length,
            aRet = [];

        while (i--)
        {
            var iC = str[i].charCodeAt();
            if (iC < 65 || iC > 127 || (iC > 90 && iC < 97))
            {
                aRet[i] = '&#' + iC + ';';
            }
            else
            {
                aRet[i] = str[i];
            }
        }
        return aRet.join('');
    }

    /**
     * Transform the Estimate on the Job passed in into a Sales Order item.
     * @param salesOrdMT
     */
    function createSalesOrderTransform(salesOrdMT)
    {
        //Get's all of the needed IDs from the DB that matched the data sent in.
        g_lookupVals = getLookupValues(salesOrdMT);

        // if (!g_lookupVals["estimate"]["internalid"])
        if (dmHelper.isNilOrEmpty(g_lookupVals["estimate"]))
        {
            var message = "Job number does not exists: " + salesOrdMT["JobNumber"];
            eCodes.INVALID_JOB_NUMBER_ERROR["message"] = message;
            throw eCodes.INVALID_JOB_NUMBER_ERROR;

            // throw {name:"INVALID_JOB_NUMBER_ERROR", message: message}
        }

        //Transforms the estimate to the Sales Order.
        var salesOrd = record.transform({
            fromType: record.Type.ESTIMATE,
            fromId: g_lookupVals["estimate"]["internalid"],
            toType: record.Type.SALES_ORDER,
            isDynamic: true,
            defaultValues: {customform: fh.getFormId("SalesOrderField")}
        });

        //Adds Items from JSON sent in.
        salesOrd.setValue("startdate", dmHelper.parseDate(salesOrdMT["ServicesFrom"]));
        salesOrd.setValue("enddate", dmHelper.parseDate(salesOrdMT["ServicesTo"]));
        salesOrd.setValue("class", g_lookupVals.estimate["custentity_osm_job_service_code"]);
        salesOrd.setValue("custbody_opportunity_id", g_lookupVals.estimate["custbody_opportunity_id"]);
        salesOrd.setValue("custbody_cseg_territory", g_lookupVals.estimate["custentity_osm_job_sales_territory"]);
        salesOrd.setValue("custbody_ava_tax_code", "AVATAX");
        salesOrd.setValue("ismultishipto", true);
        //Bill Address List originally used to get populated in the next line, however due to invoice grouping issue where the Bill Address List gets set as -Custom-, we are moving the line - [Nagarro, 31 May 2024]
        //salesOrd.setValue("billaddresslist", salesOrdMT["BillToSeqNum"]);
        salesOrd.setValue("custbody_sales_order_unique_id", salesOrdMT["UniqueID"]);
        salesOrd.setValue("otherrefnum", salesOrdMT["PONumber"]);
        // set custbody_job to use in reporting by finance for GL impact of kit component items
        salesOrd.setValue("custbody_job", salesOrd.getValue("job"));

        var dept = cHelper.getScriptParameterValue("custscript_osm_invoice_dept_import");
        salesOrd.setValue("department", dept);

        var date = getPostingPeriod();

        salesOrd.setValue("trandate", moment(date).toDate());
        // salesOrd.setValue("custbody_osm_sales_order_discount_rate", salesOrdMT["PctDiscount"]);
        // salesOrd.setValue("custbody_osm_retention_amt", salesOrdMT["PctRetention"]);

        var notes = "";

        //Add the Order Notes if sent in.
        if (salesOrdMT["OrderNotes"])
        {
            salesOrdMT["OrderNotes"].forEach(function (s)
            {
                notes += s + "<br>";
            });

            salesOrd.setValue("custbody_osm_item_invoice_notes", notes.replace(/&/g, "&amp;"));
            // salesOrd.setValue("custbody_osm_item_invoice_notes", notes.replace(/&amp;/g, "&amp;"));
            // salesOrd.setValue("custbody_osm_item_invoice_notes", HTMLEncode(notes));
            // salesOrd.setValue("custbody_osm_item_invoice_notes", notes.replace(/c/g, "&amp;"));
        }

        //Add only items sent in from JSON that are also on the Estimate.
        salesOrd = syncLineItems(salesOrdMT, salesOrd, false);
        //Populating Bill Address List below so the SyncLineItems function does not intefere with the BillToSelect value as it was doing previously - [Nagarro, 31 May 2024]
        salesOrd.setValue("billaddresslist", salesOrdMT["BillToSeqNum"]);
        salesOrd.setValue("status", salesOrdMT["Status"]);

        if(g_lookupVals.groupInvoices){
            salesOrd.setValue("forinvoicegrouping", true);
        }

        checkIfSOExists(salesOrdMT["UniqueID"]);
        g_salesOrdId = salesOrd.save();
        return salesOrd
    }

    /**
     * Get's all of the internal ids and extra information not sent in with the Sales Order Data.
     * @param salesOrd
     * @returns {Array}
     */
    function setupSearchResults(salesOrd)
    {
        var columns = ["tranid", "job.entityid",
            {
                "name": "internalid",
                "join": "job",
                "label": "jobInternalId"
            },
            {"name": "externalid", "join": "customerMain", "label": "customerId"},
            "job.custentity_osm_job_sales_territory", "custcol_osm_material_cost_per_item", "custbody_opportunity_id", "job.custentity_osm_job_service_code", "entity",
            "internalid", "rate", "total", "item.itemid", "custcol_osm_total_material_cost", "item.description", "item.displayname", "memo",
            {"name": "formulaNumeric", "formula": "ABS({custbody_osm_retention_rate})", "label": "retentionRate"},
            {
                "name": "formulaNumeric",
                "formula": "ABS({custbody_osm_field_discount_rate})",
                "label": "discountRate"
            }
        ];

        var filters = [];
        filters.push(invHelp.getEstimateFilters(salesOrd));
        if (filters.length > 0)
        {
            filters.push("and");
            filters.push(["type", "anyof", "Estimate"]);
        }
        else
        {
            filters = ["type", "anyof", "Estimate"];
        }
        estimateJSON = sHelper.getSearchResultsObj("estimate", columns, filters);
        customerJSON = sHelper.getSearchResultsObj("customer", ["internalid", "subsidiary", "entityid", "groupinvoices"], invHelp.getCustomerFilters(salesOrd));
        itemsJSON = sHelper.getSearchResultsObj("item", ["internalid", "itemid", "type", "custitem_osm_service_for_sale_item", "custitemosm_material_only"], invHelp.getItemFilters(salesOrd));


        // memberItemsJSON = sHelper.getSearchResultsObj("item",
        //     ["memberitem.itemid", "memberitem.assetaccount", "memberitem.expenseaccount"],
        //     invHelp.getItemFilters(salesOrd));
        // uomJSON = sHelper.getSearchResultsObj("unitstype", ["internalid", "unitname", "conversionrate", "abbreviation"]);

        var cols = [{"name": "custrecord_osmose_field_inv_itemid", "label": "itemId"},
            {"name": "custrecord_osmose_field_rentention_item", "label": "retentionItem"},
            {"name": "custrecord_osmose_field_subtotal_item", "label": "subTotalItem"},
            {
                "name": "formulaNumeric",
                "formula": "ABS({custrecord_osmose_field_inv_itemid.vendorcost})",
                "label": "rate"
            }];

        //Get's the SubTotal/Discount/Retention Items
        specialItemsJSON = sHelper.getSearchResultsObj("customrecord_osmose_field_inv_spec_item", cols);

        // acctPeriodJSON global var set in method
        setAccountingPeriod();

        return estimateJSON
    }

    /**
     * Sets the accounting Period search data
     *
     * @returns Json search results
     */
    function setAccountingPeriod()
    {
        var cols = ["internalid", "arlocked", "parent", "periodname", "closedondate", "startdate", {
            "name": "enddate",
            "label": "enddate",
            "sort": "DESC"
        }];
        var filters = [["arlocked", "is", "F"],
            "AND", ["enddate", "onorbefore", "nextmonth"],
            "AND", ["periodname", "isnotempty", ""],
            "AND", ["startdate", "onorafter", "startofmonthbeforelast"],
            "AND", ["isadjust", "is", "F"],
            "AND", ["isquarter", "is", false]];
        acctPeriodJSON = sHelper.getSearchResultsObj("accountingperiod", cols, filters);
    }


    /**
     * Calculates the Invoice and Sales Order data to be returned to the NetSuite Services.
     * @param searchResultsObj
     * @returns {{total: number, pretax: number, preRetention: number, salesOrderTotal: number}}
     */
    function calculateInvoiceData(searchResultsObj)
    {
        var preRetention = 0;
        var total = parseFloat(searchResultsObj["total"]);
        var taxTotal = parseFloat(searchResultsObj["taxtotal"]);
        var pretax = parseFloat(total - taxTotal);
        var retention = 1 - parseFloat(searchResultsObj["retentionRate"]);
        var discount = 1 - parseFloat(searchResultsObj["discountRate"]);

        //get price before retention rate.
        if (searchResultsObj["retentionRate"])
        {
            preRetention = (pretax / retention).toFixed(2);
        }
        //Get price before discount rate.
        else if (searchResultsObj["discountRate"])
        {
            preRetention = (pretax / discount).toFixed(2);
        }
        else
        {
            //No discount or retention.
            preRetention = pretax;
        }
        return {
            total: total, pretax: pretax, preRetention: preRetention,
            salesOrderTotal: parseFloat(searchResultsObj["Sales Order Total"])
        };
    }

    /**
     * Get's all information for the return object.
     * @param allSOIds All Sales Order IDs that were created.
     * @returns {Array}
     */
    function getInvoiceID(allSOIds)
    {
        var dateTime = new Date();
        var SOIds = [];
        var SOWithoutInvoice = [];

        //Set's up the search object based on rather it had an invoice or not.
        allSOIds.map(function (n)
        {
            if (n["hasInvoice"])
            {
                SOIds.push(n["orderId"]);
            }
            else
            {
                SOWithoutInvoice.push(n["orderId"]);
            }
        });

        var returnObj = []; //Combined results of both searches.
        var salesObjWithoutInvoice;

        //Get all data for Sales Orders with Invoices.
        if (SOIds.length > 0)
        {
            returnObj = sHelper.getSearchResultsObj("invoice", [{name: "tranid", label: "InvoiceId"},
                {
                    name: "tranid",
                    label: "SalesOrderId",
                    join: "createdfrom"
                },
                {
                    name: "internalid",
                    label: "SalesOrderInternalId",
                    join: "createdfrom"
                },
                {"name": "trandate", "label": "InvoiceDate"},
                {
                    "name": "total",
                    "join": "createdfrom",
                    "label": "Sales Order Total"
                }, "total", "taxtotal",
                {
                    "name": "formulaNumeric",
                    "formula": "ABS({custbody_osm_retention_rate})",
                    "label": "retentionRate"
                },
                {
                    "name": "formulaNumeric",
                    "formula": "ABS({custbody_osm_field_discount_rate})",
                    "label": "discountRate"
                }
            ], [["createdfrom.internalid", "anyof", SOIds], "and", ["mainline", "is", true], "and", ["subsidiary", "noneof", "44"]], "", false); //Subsidiary added to exclude imcorp subsidiary
        }
        //Get all data for Sales Orders without Invoices.
        if (SOWithoutInvoice.length > 0)
        {
            salesObjWithoutInvoice = sHelper.getSearchResultsObj("salesorder", [{
                "name": "total",
                "label": "Sales Order Total"
            }, {
                name: "tranid",
                label: "SalesOrderId"
            }, {
                name: "internalid",
                label: "SalesOrderInternalId"
            }, {
                "name": "trandate",
                "label": "InvoiceDate"
            }], [["internalid", "anyof", SOWithoutInvoice], "and", ["mainline", "is", true], "and", ["subsidiary","noneof", "44"]], "", false);//Subsidiary added to exclude imcorp subsidiary
            returnObj = returnObj.concat(salesObjWithoutInvoice);
        }

        var results = [];

        //Creates the return object. returnObj is the combined results of both above searches.
        for (var i = 0; i < returnObj.length; i++)
        {
            var searchResultsObj = returnObj[i];
            var salesOrd = searchResultsObj["SalesOrderInternalId"];
            //Loop through list of all Sales Orders that were created.
            for (var j = 0; j < allSOIds.length; j++)
            {
                var jSalesOrd = allSOIds[j]["orderId"];
                //If the current search results Sales Order =='s current Sales Order created, then create the return object.
                if (salesOrd == jSalesOrd)
                {
                    //Get and calculate the invoice amounts
                    var invoiceAmounts = calculateInvoiceData(searchResultsObj);
                    var obj = {
                        UniqueId: allSOIds[j]["uniqueId"],
                        SalesOrderId: searchResultsObj["SalesOrderId"],
                        InvoiceId: searchResultsObj["InvoiceId"],
                        InvoiceTotal: invoiceAmounts.total,
                        SalesOrderTotal: parseFloat(searchResultsObj["Sales Order Total"]),
                        InvoicePreTax: invoiceAmounts.pretax,
                        InvoicePreDiscountRetention: invoiceAmounts.preRetention,
                        InvoiceDate: searchResultsObj["InvoiceDate"]
                    };
                    //add return data to array to be returned to Client NetSuite Services.
                    results.push(obj);

                    //If the Invoice amount does NOT equal the Sales order amount, then it was partially filled and it needs to be reviewed.
                    if (invoiceAmounts["total"] && invoiceAmounts["total"] != invoiceAmounts.salesOrderTotal)
                    {
                        emailHelper.sendEmail("Partial Fulfillment", JSON.stringify(g_fullJson) + " ----- " + JSON.stringify(obj), g_emailTo);
                    }
                    break;
                }
            }
        }

        // cHelper.logTimeDiff(dateTime, "build return object");
        return results;
    }

    //Rollback changes for job if it failed at any level.
    function rollback(entries)
    {
        // var obj = {};

        if (entries)
        {
            var delObj = {
                invoiceId: entries["invId"],
                itemFulfillmentId: entries["ifId"],
                invAdjustId: entries["iaId"]
            };
            if (delObj)
            {
                log.debug("delObj", delObj);
            }
            if (entries["invId"])
            {
                cHelper.deleteRecord(record.Type.INVOICE, entries["invId"]);
            }
            if (entries["ifId"])
            {
                cHelper.deleteRecord(record.Type.ITEM_FULFILLMENT, entries["ifId"]);
            }
            if (entries["iaId"])
            {
                try
                {
                    cHelper.deleteRecord(record.Type.INVENTORY_ADJUSTMENT, entries["iaId"]);
                }
                catch (e)
                {
                    log.error("Inventory Adjustment ID", "Could not delete inventory adjusmtnet " + entries["iaId"])
                }
            }
        }
        //if job was created, deleted it.
        if (g_salesOrdId)
        {
            try
            {
                cHelper.deleteRecord(record.Type.SALES_ORDER, g_salesOrdId);
            }
            catch (e)
            {
                try
                {
                    log.debug("sales ord id", g_salesOrdId);
                    var results = sHelper.search("invoice", ["internalid", "createdfrom"], [["createdfrom", "is", g_salesOrdId], "and", ["mainline", "is", true]]);
                    if (results.length > 0)
                    {
                        var result = results[0];
                        log.error("createdfrom", result["createdfrom"]);
                        if (result["createdfrom"] == g_salesOrdId)
                        {
                            cHelper.deleteRecord(record.Type.INVOICE, result["internalid"]);
                            cHelper.deleteRecord(record.Type.SALES_ORDER, g_salesOrdId);
                            emailHelper.sendEmail("SO Deletion", "Second attempt to delete the invoice and sales order were successfull.", g_emailTo);
                        }
                    }
                    else
                    {
                        // log.error("logged error", eHelper.getError(e));
                    }
                }
                catch (ex)
                {
                    try
                    {
                        emailHelper.sendEmail("SO Deletion - Failed", "Sales Order " + g_salesOrdId + " could not be deleted.", g_emailTo);
                    }
                    catch (exer)
                    {

                    }
                    // log.error("logged error", eHelper.getError(ex));
                    // log.error("logged error", eHelper.getError(e));
                }
            }
        }
    }

    /**
     * Create Inventory Adjustment (if needed), Item Fulfillment, and Invoice.
     * @param salesOrderId
     * @returns {{message: string, invId: *, ifId: *, iaId: *, error: *}}
     */
    function createAdditionalRecords(salesOrderId)
    {
        //Load the sales order that was just created. NetSuite does not give it back on .save() -- stupid.
        var newRec = record.load({
            type: "SALESORDER",
            id: salesOrderId
        });
        // cHelper.logTimeDiff(datetime, "load sales order");

        var invAdjustObj;
        var returnObj;

        //Setup return object to handle the saved data and any errors that may have occurred.
        var iaId, invId, ifId, error;

        // If it is a field sales order and it is pending fulfillment, continue.
        var orderStatus = newRec.getValue("orderstatus").formatValue();

        if (newRec.getValue("customform") == fh.getFormId("SalesOrderField") && (orderStatus == "B" || orderStatus == "F"))
        {
            returnObj = invHelp.createEntries(newRec, acctPeriodJSON);
            invAdjustObj = returnObj["invAdjustObj"];
        }

        if (invAdjustObj)
        {
            if (invAdjustObj["invAdjustId"])
            {
                iaId = invAdjustObj["invAdjustId"];
                log.debug("inventory adjustment ID", iaId);
                g_message += invHelp.emailBodyString(invAdjustObj["returnObj"]); //Fills in the table.
            }
            if (returnObj["invId"])
            {
                invId = returnObj["invId"]
            }
            if (returnObj["ifId"])
            {
                ifId = returnObj["ifId"]
            }
        }
        if (returnObj)
        {
            if (returnObj["error"])
            {
                try
                {
                    error = JSON.parse(returnObj["error"]);
                }
                catch (e)
                {
                    error = returnObj["error"];
                }
            }
        }
        return {message: g_message, invId: invId, ifId: ifId, iaId: iaId, error: error};
    }


    /**
     * Creates, initializes and returns the sales order response json data for CRUD operations
     */
    function initializeSalesOrderResponse()
    {
        var soResponse = {};
        soResponse.FailureCount = 0;
        soResponse.SuccessCount = 0;
        soResponse.OverallCount = 0;
        soResponse.Errors = [];
        soResponse.SalesOrderIdentifier = [];
        soResponse.FailedData = [];
        soResponse.Governance = 0;
        return soResponse;
    }

    function _post(salesOrders, test)
    {
        // if (test)
        // {
        //     return salesOrders
        // }
        g_emailTo = emailHelper.get.SALES_ORDER_IMPORT();
        // if (salesOrders[0]["test"] == true)
        // {
        //     emailHelper.sendEmail("pardddddtial fulfillment", "test", ["033687", "070843", "037648"]);
        //     return "hello";
        // }
        try
        {
            var ultDateTime = new Date();
            datetime = new Date();
            var allSalesOrderIds = [];

            //Setup the return object
            if (response)
            {
                for (var member in response) delete response[member]
            }
            var response = initializeSalesOrderResponse();

            //parses the data sent and performs all the necessary searches (to get Netsuite IDs) before beginning.
            var datetime = new Date();
            setupSearchResults(salesOrders);

            //Get's all of the governance used.// addGov(soHelper.getGov());
            g_fullJson = salesOrders;
            // emailHelper.sendEmail("sales order json data", JSON.stringify(salesOrders), emailHelper.get.DEVELOPER(), true);
            //If data exceeds log max length, email me the JSON (should only be viewable in netsuite. I should not get an email).
            // if (JSON.stringify(salesOrders).length > 3998)
            // {
            //     emailHelper.sendEmail("sales order json data", JSON.stringify(salesOrders), "070843", true);
            log.debug("full json", salesOrders);
            // }
        }
        catch (e)
        {
            // log.error("logged error", eHelper.getError(e));
            var errorObj = new eHelper.Error(e);
            return eHelper.getError(e);
        }

        var message = "";
        var invoiceObj;

        //Loop through the data sent in.
        for (var i in salesOrders)
        {
            invoiceObj = {};

            // I believe this was used for testing. This exists under createSalesOrderTransform at the top of the method.
            // g_lookupVals = getLookupValues(salesOrders[i]);

            //reset current global salesOrd info
            g_salesOrdId = null;
            var salesOrd = salesOrders[i];
            try
            {
                //throws an error if this sales order has already been uploaded.
                var datetime = new Date();

                var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
                if (remainingUsage >= g_minGovRequired)
                {
                    //Creates a sales order based off of the data. The Sales Order ID is held in a global variable.
                    var so = createSalesOrderTransform(salesOrd);
                }
                else
                {
                    throw eCodes.GOVERNANCE_LIMIT_EXCEEDED;
                }

                // cHelper.logTimeDiff(datetime, "full sales order creation time");
                var hasInvoice = false;
                datetime = new Date();

                //If pending fulfillment, it needs to be setup to be invoiced. If not, only the Sales Order is needed.
                if (dmHelper.formatValue(salesOrd["Status"]) == "PENDING FULFILLMENT")
                {
                    hasInvoice = true;
                }

                //Create inventory adjustment, item fulfillment, and invoice if needed. The conditional statements are inside this method.
                invoiceObj = createAdditionalRecords(g_salesOrdId);

                var invId = invoiceObj["invId"];

                if (invoiceObj["error"])
                {
                    throw invoiceObj["error"];
                }
                else if (invId)
                {
                    var invTotal;
                    var soTotal;
                    try
                    {
                        invTotal = search.lookupFields({
                            type: "INVOICE",
                            id: invoiceObj["invId"],
                            columns: ['total']
                        })["total"];

                        soTotal = so.getValue("total");
                    }
                    catch (exr)
                    {
                        log.debug("invTotal", invTotal);
                        log.debug("soTotal", soTotal);
                        log.error("Error", exr);
                    }

                    if (invTotal != soTotal)
                    {
                        try
                        {
                            emailHelper.sendEmail("Partial Fulfillment Error", JSON.stringify(salesOrd), g_emailTo);
                        }
                        catch (exr)
                        {
                            log.error("Error Sending Email", exr);
                        }
                        throw eCodes.PARTIAL_FULFILLMENT_ERROR;
                    }
                }

                //This is used to create the return object.
                allSalesOrderIds.push({
                    orderId: g_salesOrdId,
                    uniqueId: salesOrd["UniqueID"],
                    invId: invoiceObj["invId"],
                    hasInvoice: hasInvoice
                });
                // message = g_message;

                response.SuccessCount += 1;
            }
            catch (e)
            {
                var errorObj = new eHelper.Error(e);
                log.error("Sales Order Exception:", eHelper.getError(e));
                
                response.FailureCount++;
                response.FailedData.push(salesOrd);

                //had to call clone here because if I didn't, the other instances in the array were being overwritten.
                var error = {
                    Error: ramda.clone(eHelper.getError(e)),
                    UniqueID: salesOrd["UniqueID"]
                };

                response.Errors.push(error);

                //Rollback all data if there is an error anywhere along the way.
                if (g_salesOrdId)
                {
                    rollback(invoiceObj);
                }
            }

            response.Governance = 5000 - (5000 - runtime.getCurrentScript().getRemainingUsage());
            response.OverallCount++;
        }

        try
        {
            // log.debug("message", g_message);
            if (g_message)
            {
                datetime = new Date();
                g_message = g_header + g_message;
                g_message += invHelp.emailFooterString(); //Closes the table.

                //Send email for inventory adjustment.
                emailHelper.sendEmail(g_subj, g_message);
            }

            if (allSalesOrderIds.length > 0)
            {
                response.SalesOrderIdentifier = getInvoiceID(allSalesOrderIds);
                log.debug("SalesOrderIdentifier", response.SalesOrderIdentifier)
            }
        }
        catch (e)
        {
            var errorObj = new eHelper.Error(e);
            emailHelper.sendEmail("Error Sending Invoice", eHelper.getError(e), g_emailTo);
        }
        cHelper.logTimeDiff(ultDateTime, "time for script to run");
        return response;
    }

    /**
     * Put Sales Order - Update to an existing sales orders
     * @param uniqueIds - list of sales orders
     * @returns Json object with failure, success, overall, errors, etc...
     */
    function _put(uniqueIds)
    {
        // initialize the email to list
        g_emailTo = emailHelper.get.SALES_ORDER_IMPORT(); // TODO; LOOK AT LIST FOR EMAIL LATER
        var ultDateTime = new Date();
        var datetime = new Date();

        try
        {
            var allSalesOrderIds = [];

            // create/initialize the response json
            var response = initializeSalesOrderResponse();

            // set acctPeriodJSON global variable
            setAccountingPeriod();

            // assign global value from the passed in sales order list
            g_fullJson = uniqueIds;
        }
        catch (e)
        {
            eHelper.Error(e);
            return eHelper.getError(e);
        }

        var invoiceObj = null;

        //Loop through the data sent in.
        for (var i in uniqueIds)
        {
            invoiceObj = {};

            // reset current global salesOrd info
            g_salesOrdId = null;
            var uniqueId = uniqueIds[i];

            try
            {
                datetime = new Date();
                var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
                var so;

                if (remainingUsage >= g_minGovRequired)
                {
                    // load and return the sales order for updating
                    so = loadSO(uniqueId);

                    // update status for A(Pending Approval) or B(Pending Fulfillment) when coming in through endpoint
                    var orderStatus = so.getValue("orderstatus").formatValue();
                    if (orderStatus === "A" || orderStatus === "B")
                    {
                        log.debug("Attempting Submit Fields:", so.getValue("id") + " : " + uniqueId + " : " + orderStatus);

                        var date = getPostingPeriod();
                        record.submitFields({
                            type: record.Type.SALES_ORDER,
                            id: so.getValue("id"),
                            values: {
                                status: 'Pending Fulfillment',
                                trandate: moment(date).toDate()
                            }
                        });
                    }
                }
                else
                {
                    throw eCodes.GOVERNANCE_LIMIT_EXCEEDED;
                }

                var hasInvoice = false;

                hasInvoice = true;

                //Create inventory adjustment, item fulfillment, and invoice if needed. The conditional statements are inside this method.
                invoiceObj = createAdditionalRecords(g_salesOrdId);
                // get the invoice ID to process below
                var invId = invoiceObj["invId"];

                // check error return from createAdditionalRecords
                if (invoiceObj["error"])
                {
                    throw invoiceObj["error"];
                }
                else if (invId)
                {
                    var invTotal;
                    var soTotal;
                    try
                    {
                        invTotal = search.lookupFields({
                            type: "INVOICE",
                            id: invoiceObj["invId"],
                            columns: ['total']
                        })["total"];

                        soTotal = so.getValue("total");
                    }
                    catch (exr)
                    {
                        log.debug("invTotal", invTotal);
                        log.debug("soTotal", soTotal);
                        log.error("Error", exr);
                    }

                    if (invTotal != soTotal)
                    {
                        try
                        {
                            emailHelper.sendEmail("Partial Fulfillment Error", JSON.stringify(uniqueId), g_emailTo);
                        }
                        catch (exr)
                        {
                            log.error("Error Sending Email", exr);
                        }
                        throw eCodes.PARTIAL_FULFILLMENT_ERROR;
                    }
                }

                // This is used in the response json data
                allSalesOrderIds.push({
                    orderId: g_salesOrdId,
                    uniqueId: uniqueId,
                    invId: invoiceObj["invId"],
                    hasInvoice: hasInvoice,
                    customerId: so.getValue("entity")
                });

                response.SuccessCount++;
            }
            catch (e)
            {
                eHelper.Error(e);
                response.FailureCount++;

                // calling clone here because if I didn't, the other instances in the array were being overwritten.
                var error = {
                    Error: ramda.clone(eHelper.getError(e)),
                    UniqueID: uniqueId
                };

                response.Errors.push(error);
                // no rollback on updating, could delete existing sales order

                log.debug("Error Updating Sales Order", eHelper.getError(e) + " errors :" + response.Errors);
            }

            response.Governance = 5000 - (5000 - runtime.getCurrentScript().getRemainingUsage());
            response.OverallCount++;

        }  // end of for loop

        try
        {
            // log.debug("message", g_message);
            if (g_message)
            {
                datetime = new Date();
                g_message = g_header + g_message;
                g_message += invHelp.emailFooterString(); //Closes the table.

                //Send email for sales order update.
                g_subj = "Sales Order Updated";
                emailHelper.sendEmail(g_subj, g_message);
            }

            if (allSalesOrderIds.length > 0)
            {
                response.SalesOrderIdentifier = getInvoiceID(allSalesOrderIds);
                log.debug("SalesOrderIdentifier", response.SalesOrderIdentifier);
            }
        }
        catch (e)
        {
            log.debug("Error Updating Sales Order", eHelper.getError(e) + " g_emailTo :" + g_emailTo);
            eHelper.Error(e);
            emailHelper.sendEmail("Error Updating Sales Order", eHelper.getError(e), g_emailTo);
        }
        cHelper.logTimeDiff(ultDateTime, "time for script to run");

        log.debug("response", response);
        return response;
    }

    /**
     * Delete Sales Order - Archive an existing sales orders
     * @param uniqueId - list of sales orders
     * @returns Json object with failure, success, overall, errors, etc...
     */
    function _delete(params)
    {
        var uniqueIds = params.uniqueId;

        if (!Array.isArray(uniqueIds))
        {
            uniqueIds = [uniqueIds];
        }
        // initialize the email to list
        g_emailTo = emailHelper.get.SALES_ORDER_IMPORT(); // TODO; LOOK AT LIST FOR EMAIL LATER
        var ultDateTime = new Date();
        var datetime = new Date();
        var errorMsg = "";

        try
        {
            var allSalesOrderIds = [];

            // create/initialize the response json
            var response = initializeSalesOrderResponse();

            // assign global value from the passed in sales order list
            g_fullJson = uniqueIds;
        }
        catch (e)
        {
            eHelper.Error(e);
            return eHelper.getError(e);
        }

        //Loop through the data sent in.
        for (var i in uniqueIds)
        {
            // reset current global salesOrd info
            g_salesOrdId = null;
            var uniqueId = uniqueIds[i];

            try
            {
                datetime = new Date();
                var remainingUsage = runtime.getCurrentScript().getRemainingUsage();

                if (remainingUsage >= g_minGovRequired)
                {
                    // load and return the sales order for updating
                    var so = loadSO(uniqueId);
                    log.debug("LoadSO() Data:", so.getValue("custbody_sales_order_unique_id") + " : " + so.getValue("id") + " : current.status[" +
                        so.getValue("status") + "] incoming.status[" + uniqueId + "]");

                    // delete/archive only  for A(Pending Approval) or B(Pending Fulfillment) from restlet
                    var orderStatus = so.getValue("orderstatus").formatValue();
                    if (orderStatus === "A")
                    {
                        log.debug("Attempting Submit Fields:", so.getValue("id") + " : " + uniqueId);
                        var sublistCount = so.getLineCount({
                            sublistId: "item"
                        });

                        log.debug("linecount", sublistCount);
                        for (var i = 0; i < sublistCount; i++)
                        {
                            so.selectLine({
                                sublistId: "item",
                                line: i
                            });
                            so.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "isclosed",
                                value: true
                            });

                            so.commitLine({sublistId: "item"});
                        }
                        so.save();
                    }
                    else
                    {
                        // errorMsg = "Unable to Delete/Archive Sales Order: " + so.getValue("id") + ", status not in Pending Approval.";

                        var error = {
                            Name: "ERROR_DELETING_SALES_ORDER",
                            UniqueID: uniqueId
                        };

                        response.Errors.push(error);
                    }
                }
                else
                {
                    throw eCodes.GOVERNANCE_LIMIT_EXCEEDED;
                }

                // This is used in the response json data
                allSalesOrderIds.push({
                    orderId: g_salesOrdId,
                    uniqueId: uniqueId,
                    invId: 0,
                    hasInvoice: false
                });

                response.SuccessCount++;
            }
            catch (e)
            {
                eHelper.Error(e);
                response.FailureCount++;
                response.FailedData.push(uniqueId);

                // calling clone here because if I didn't, the other instances in the array were being overwritten.
                var error = {
                    Error: ramda.clone(eHelper.getError(e)),
                    UniqueID: uniqueId
                };

                response.Errors.push(error);
                // no rollback on updating, could delete existing sales order
            }

            response.Governance = 5000 - (5000 - runtime.getCurrentScript().getRemainingUsage());
            response.OverallCount++;

        }  // end of for loop

        try
        {
            if (allSalesOrderIds.length > 0)
            {
                response.SalesOrderIdentifier = getInvoiceID(allSalesOrderIds);
                log.debug("SalesOrderIdentifier", response.SalesOrderIdentifier);
            }
        }
        catch (e)
        {
            eHelper.Error(e);
            emailHelper.sendEmail("Error Deleting Sales Order", eHelper.getError(e), g_emailTo);
        }
        cHelper.logTimeDiff(ultDateTime, "time for script to run");

        return response;
    }


function pnvl(value, number) {
    if (number) {
        if (isNaN(parseFloat(value))) return 0;
        return parseFloat(value);
    }
    if (value === null || value === undefined || value === 'null') return '';
    return '' + value;
}
  
    return {
        post: _post,
        put: _put,
        delete: _delete
    }
}
);