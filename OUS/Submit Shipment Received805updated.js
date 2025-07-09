/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/https', 'N/file', "N/email", "/SuiteScripts/Source/Libs/HelperClasses/searchHelper",
        "/SuiteScripts/Source/Libs/HelperClasses/commonHelper", "/SuiteScripts/Source/Libs/HelperClasses/emailHelper",
        "/SuiteScripts/Source/Libs/HelperClasses/dataHelper", "/SuiteScripts/Source/Libs/Handlers/fileHandler"],
    function (serverWidget, record, search, https, file, email, sHelper, cHelper, emHelper, dmHelper, fHandler)
    {

        var titleText = 'Shipment Confirmation';

        //deprecated as long as we cannot update the item fulfillment.
        function updateItemReceiptQty(count, request, itemReceipt)
        {
            var bShipmentCorrect = true;
            for (var i = 0; i < count; i++)
            {
                var count = request.getLineCount({
                    group: "custpage_itemsublist"
                });
                // var shipmentSublist = request.getSublist("custpage_itemsublist");
                //Set the suitelet sublist current line in order to retrieve sublist[i] line's values.
                // shipmentSublist.selectLine({
                //     sublistId: "custpage_itemsublist",
                //     line: i
                // });

                //Get the qty of the i item.
                var qtyReceived = request.getSublistValue({
                    group: "custpage_itemsublist",
                    name: "qty",
                    line: i
                });


                // var qtyReceived = parseFloat(shipmentSublist.getCurrentSublistValue({
                //     sublistId: "custpage_itemsublist",
                //     fieldId: "qty"
                // }));

                //Get the itemno of the i item.
                // var itemNo = shipmentSublist.getCurrentSublistValue({
                //     sublistId: "custpage_itemsublist",
                //     fieldId: "itemno"
                // });
                var itemNo = request.getSublistValue({
                    group: "custpage_itemsublist",
                    name: "itemno",
                    line: i
                });
                var itemFul = record.load({
                    type: record.Type.ITEM_RECEIPT,
                    id: itemReceipt.getValue("itemfulfillment")
                });

                itemFul.setValue("qty");

                //Get Item Receipt qty.
                var rowNo = itemReceipt.findSublistLineWithValue({
                    sublistId: "item",
                    fieldId: "itemname",
                    value: itemNo
                });
                // log.debug({
                //     title: "Changed Record",
                //     details: rowNo
                // });

                // log.debug("test", "qty: " + qtyReceived + "    itemNo: " + itemNo);

                if (rowNo != -1)
                {
                    itemReceipt.selectLine({
                        sublistId: "item",
                        line: rowNo
                    });

                    var irQty = parseFloat(itemReceipt.getCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity"
                    }));

                    // var irQty = itemReceipt.getSublistValue({
                    //     sublistId: "item",
                    //     fieldId: "quantity",
                    //     line: rowNo
                    // });
                    // log.debug("test", "does " + irQty + "!=" + qtyReceived)
                    if (irQty != qtyReceived)
                    {
                        bShipmentCorrect = false;

                        itemReceipt.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            // line: rowNo,
                            value: qtyReceived
                        });
                        itemReceipt.commitLine({sublistId: "item"});
                    }
                    else
                    {
                    }
                }
                else
                {
                    log.audit("item no found", "The item, " + itemNo + " item was not found.")
                }
            }
            if (!bShipmentCorrect)
            {
                //Send an email here.
            }
            // return bShipmentCorrect;
        }

        function getItemFulfillmentData(itemFulfillmentID)
        {
            var type = "ITEMFULFILLMENT";
            var cols = ["internalid", "createdfrom", "tranid", "item", "quantity", "item.displayname", "location", "item.itemid", "status", "entity", "statusRef", "type"];
            var filts = [["tranid", "is", itemFulfillmentID], "AND", ["shipping", "is", "F"], "AND", ["cogs", "is", "F"], "AND", ["taxline", "is", "F"]];

            return sHelper.search(type, cols, filts);
        }

        function getCreatedFromRecord(createdFrom)
        {
            var mySearch = search.create({
                type: "TRANSACTION",
                columns: ["status", "type"],
                filters: [["internalid", "is", createdFrom]]
            }).run().getRange({start: 0, end: 1});

            var results = mySearch[0];
            return results;
            return results.getValue("status") == "received";
        }

        function setupSearchForm(form, msg)
        {
            var field = form.addField({
                id: "custpage_item_fulfillment_number",
                type: "TEXT",
                label: "IF Number:"
            });

            field.updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
            });
            form.addButton({
                id: 'custpage_searchitemful',
                label: 'Search',
                functionName: 'SearchIF'
            });
            // 50419

            var fileContents = file.load(fHandler.Item_Received_CS).getContents();
            var field = form.addField({
                id: 'custpageinjectcode',
                type: 'INLINEHTML',
                label: 'Inject Code'
            });
            field.defaultValue = "<script>" + fileContents + "</script>";

            if (msg)
            {
                var field = form.addField({
                    id: 'custpage_does_not_exists',
                    type: 'INLINEHTML',
                    label: 'Inject Code'
                });
                form.title = titleText + " - Received";
                field.defaultValue = "<script>" + msg + "</script>";
            }
            else
            {
            }
            form.title = titleText + " - Search";
        }

        function setupItemFulFilForm(formTemp, itemFulfillment, tfoStatus, itemFulfillmentID)
        {
            //region add fields to formTemp
            //Create sublist
            var sublist = formTemp.addSublist({
                id: 'custpage_itemsublist',
                type: serverWidget.SublistType.LIST,
                label: 'Shipment Details'
            });

            //Field will hold the transfer order ID and set it to hidden. Can be gathered when Shipment Received is clicked.
            var tranOrderIDField = formTemp.addField({
                id: "transferordernumber",
                type: "text",
                label: "Transfer Order ID:"
            });

            tranOrderIDField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            //Field will hold the transfer order ID and set it to hidden. Can be gathered when Shipment Received is clicked.
            var ifIdField = formTemp.addField({
                id: "itemfulfillmentid",
                type: "text",
                label: "Item Fulfillment ID:"
            });

            ifIdField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            //Adds the qty field to the sublist.
            var qty = sublist.addField({
                id: 'qty',
                type: serverWidget.FieldType.TEXT,
                label: 'Qty'
            });

            // qty.updateDisplayType({
            //     displayType: serverWidget.FieldDisplayType.ENTRY
            // });

            //Adds Item Number to sublist.
            sublist.addField({
                id: 'itemno',
                type: serverWidget.FieldType.TEXT,
                label: 'Item Number'
            });

            //Adds Description to the sublist.
            sublist.addField({
                id: 'description',
                type: serverWidget.FieldType.TEXT,
                label: 'Description'
            });
            //Field for reporting issues.
            var issue = formTemp.addField({
                id: 'custpage_issues',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'Report a Problem'
            });
            issue.updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
            });
            //endregion

            var itemFulExists = false;
            var lines = itemFulfillment.getLineCount({sublistId: "item"});

            log.debug("lines", lines);
            //Update the sublist with values.
            for (var i = 0; i < lines; i++)
            {
                var item = itemFulfillment.getSublistText({
                    sublistId: "item",
                    fieldId: "itemname",
                    line: i
                });
                var desc = itemFulfillment.getSublistValue({
                    sublistId: "item",
                    fieldId: "description",
                    line: i
                });
                var qty = itemFulfillment.getSublistValue({
                    sublistId: "item",
                    fieldId: "quantity",
                    line: i
                }).toString();

                sublist.setSublistValue({
                    id: "qty",
                    line: i,
                    value: qty
                });

                sublist.setSublistValue({
                    id: "itemno",
                    line: i,
                    value: item
                });

                sublist.setSublistValue({
                    id: "description",
                    line: i,
                    value: desc || " "
                });

                itemFulExists = true;
            }
            var shipStatus = dmHelper.formatValue(itemFulfillment.getValue("status"));  //Returns if the IF has been shipped.

            ifIdField.defaultValue = itemFulfillment.id.toString();
            var createdFrom = itemFulfillment.getValue("createdfrom");
            tranOrderIDField.defaultValue = createdFrom;

            //Only show the shipment received button if the item fulfillment has been shipped. (can't receipt IF that hasn't been shipped).
            if (shipStatus === "SHIPPED")
            {
                if (!tfoStatus)
                {
                    formTemp.addSubmitButton({
                        label: 'Shipment Received'
                    });
                }
                else
                {
                    var field = formTemp.addField({
                        id: 'custpageinjectcode',
                        type: 'INLINEHTML',
                        label: 'Inject Code'
                    });
                    formTemp.title = titleText + " - Received";
                    field.defaultValue = "<script>" + cHelper.displayMessageOnLoad("This order has already been marked as received.") + "</script>";
                }
            }
            else
            {
                // var fileContents = file.load(63465).getContents();

                var field = formTemp.addField({
                    id: 'custpageinjectcode',
                    type: 'INLINEHTML',
                    label: 'Inject Code'
                });
                var msg = itemFulfillmentID + " has not been marked as shipped and therefore cannot be marked as received.";
                field.defaultValue = "<script>" + cHelper.displayMessageOnLoad(msg) + "</script>";
                formTemp.title = titleText + " - NOT Shipped";
            }
        }

        var lineBreak = "<br/>";

        /**
         * Emails the issue if one is filled in.
         * @param itemFulfil record
         * @param tranOrd record
         * @param issues Issues
         */
        function submitIssues(itemFulfil, tranOrd, issues)
        {
            var tfo = tranOrd.getText("tranid");
            var ter = tranOrd.getText("custbody_cseg_territory");
            var ifNo = itemFulfil.getText("tranid");
            // var headers = ["Transfer Order", "Item", "Qty", "Territory"];
            var headers = ["Item", "Description", "Qty"];

            var lineCount = itemFulfil.getLineCount({sublistId: "item"});
            var message = "";
            for (var i = 0; i < lineCount; i++)
            {
                var item = itemFulfil.getSublistText({
                    sublistId: "item",
                    fieldId: "itemname",
                    line: i
                });

                var qty = itemFulfil.getSublistValue({
                    sublistId: "item",
                    fieldId: "quantity",
                    line: i
                });

                var desc = itemFulfil.getSublistValue({
                    sublistId: "item",
                    fieldId: "description",
                    line: i
                });

                message += emHelper.emailBodyString(emHelper.fillInColumns(headers, [item, desc, qty]));
                // message += emHelper.emailBodyString(emHelper.fillInColumns(headers, [tfo, item, qty, ter]));
            }
            message = emHelper.emailHeaderString(headers) + message;
            message += emHelper.emailFooterString(message);

            var subj = 'Transfor Order Shipment issue';
            var msg = "<b>Transfer Order: </b>" + tfo + lineBreak;
            msg += "<b>Item Fulfillment: </b>" + ifNo + lineBreak;
            msg += "<b>Territory: </b>" + ter + lineBreak;
            msg += "<b>Issues: </b><br/>" + issues + lineBreak + lineBreak;

            var emailAddress = cHelper.getScriptParameterValue("custscript_osm_item_received_email");
            // var msg = "The following problems with Transfer Order : " + tfo + " have occurred.\n\n" + issues;
            emHelper.sendEmailToEmailAddress(subj, msg + "<br/><br/>" + message, emailAddress, false, {
                transactionId: itemFulfil.id.toString()
            });
        }

        function transformToItemReceipt(transferOrderID, itemFulfillmentID, request)
        {
            // var bShipmentCorrect = updateItemReceiptQty(count, request, itemReceipt); //deprecated as long as we cannot update the item fulfillment.
            var issues = request.parameters["custpage_issues"].trim();
            log.debug("issues", issues);
            if (issues)
            {
                var tranOrd = record.load({
                    id: transferOrderID,
                    type: "TRANSFERORDER"
                });

                var itemFulfil = record.load({
                    id: itemFulfillmentID,
                    type: "ITEMFULFILLMENT"
                });
                submitIssues(itemFulfil, tranOrd, issues);
            }

            var itemReceipt = record.transform({
                fromType: record.Type.TRANSFER_ORDER,
                fromId: transferOrderID,
                toType: record.Type.ITEM_RECEIPT,
                isDynamic: true,
                defaultValues: {
                    itemfulfillment: itemFulfillmentID
                }
            });

            itemReceipt.setValue("custbody_vendor_shipper_document_no", "Field Receipt acknowledged by hand held");


            return itemReceipt;

        }

        function formatIFNumber(itemFulfillmentID)
        {
            if (itemFulfillmentID && (itemFulfillmentID || "").toUpperCase().indexOf("IF") == -1)
            {
                itemFulfillmentID = "IF" + itemFulfillmentID
            }

            return (itemFulfillmentID || "").toUpperCase();
        }

        function generateForm(context, form)
        {
            var itemFulfillmentID = formatIFNumber(context.request.parameters["tranid"]);

            if (itemFulfillmentID)
            {
                var msg = itemFulfillmentID;
                var mySearch = getItemFulfillmentData(itemFulfillmentID);
                // log.debug("mysearch", mySearch);
                //Get's all item's on the item fulfillment
                // var mySearch = getItemFulfillmentData(itemFulfillmentID).run();
                if (mySearch.length <= 0)
                {
                    msg += " does not exists. Please try again.";
                    //Creates the search form for when an Item Fulfillment number is not passed.
                    setupSearchForm(form, cHelper.displayMessageOnLoad(msg));
                    return false;
                }
                var itemFulfil = record.load({
                    id: mySearch[0]["internalid"],
                    type: "ITEMFULFILLMENT"
                });

                // var results = mySearch.getRange({start: 0, end: 1});
                var results = mySearch;
                if (results.length > 0)
                {
                    var createdFrom = results[0]["createdfrom"];   //ex: transfer order id.
                    // var createdFrom = results[0].getValue("createdfrom");   //ex: transfer order id.

                    var recCreatedFrom = getCreatedFromRecord(createdFrom);
                    var type = recCreatedFrom.getValue("type");
                    var tfoStatus = recCreatedFrom.getValue("status") == "received";
                    // var employee = recCreatedFrom.getValue("employee");

                    if (type == "TrnfrOrd")
                    {
                        setupItemFulFilForm(form, itemFulfil, tfoStatus, itemFulfillmentID);
                    }
                    else
                    {
                        msg += " is not a transfer order. Please try again.";
                        setupSearchForm(form, cHelper.displayMessageOnLoad(msg));
                    }
                }
                else
                {
                    msg += " does not exists. Please try again.";
                    //Creates the search form for when an Item Fulfillment number is not passed.
                    setupSearchForm(form, cHelper.displayMessageOnLoad(msg));
                }
            }
            else
            {
                //Creates the search form for when an Item Fulfillment number is not passed.
                setupSearchForm(form);
            }
        }

        function createItemReceipt(context, form)
        {
            var request = context.request;

            var transferOrderID = request.parameters["transferordernumber"];

            if (transferOrderID)
            {

                try {
                    var itemFulfillmentID = request.parameters["itemfulfillmentid"].toString();
                    var itemReceipt = transformToItemReceipt(transferOrderID, itemFulfillmentID, request);
                    itemReceipt.save();
                } catch(err) {
                    if(err.message.indexOf('not initialize') > 0 || err.message.indexOf('enter at least one line') > 0) {
                    throw 'This fulfillment has already been processed';
                    } else {
                    throw err.message;
                    }
                }

                var field = form.addField({
                    id: "custpage_item_fulfillment_number",
                    type: "HELP",
                    label: "Item Receipt created Successfully!"
                });

                field.updateLayoutType({
                    layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
                });
            }
        }

        function onRequest(context)
        {
            var response = context.response;
            var form = serverWidget.createForm({title: titleText});
            // form.clientScriptFileId = 50419;

            if (context.request.method === "GET")
            {
                generateForm(context, form);
            }
            else
            {
                createItemReceipt(context, form);
            }
            response.writePage(form);
        }

        // function onResponse(context)
        // {
        //     log.debug("respond", "response");
        //     console.write("hello");
        // }

        return {
            onRequest: onRequest,
            // onResponse: onResponse
        }
    });