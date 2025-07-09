/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/https', 'N/file', "N/email", "/SuiteScripts/Source/Libs/HelperClasses/searchHelper",
    "/SuiteScripts/Source/Libs/HelperClasses/commonHelper", "/SuiteScripts/Source/Libs/HelperClasses/emailHelper",
    "/SuiteScripts/Source/Libs/HelperClasses/dataHelper", "/SuiteScripts/Source/Libs/Handlers/fileHandler"],
    function (serverWidget, record, search, https, file, email, sHelper, cHelper, emHelper, dmHelper, fHandler) {

        var titleText = 'Shipment Confirmation'; // Title for the Suitelet form

        /**
         * Updates the quantities on an Item Receipt based on user input from the Suitelet sublist.
         * Note: Deprecated until Item Fulfillment updates are supported.
         * @param {number} count - Number of lines in the sublist
         * @param {Object} request - Suitelet request object
         * @param {Object} itemReceipt - Loaded Item Receipt record
         * @returns {boolean} - Indicates if the shipment quantities are correct
         */
        function updateItemReceiptQty(count, request, itemReceipt) {
            var bShipmentCorrect = true; // Flag to track if shipment quantities match
            for (var i = 0; i < count; i++) {
                var lineCount = request.getLineCount({
                    group: "custpage_itemsublist"
                }); // Get total lines in the custom sublist

                // Retrieve quantity received from the sublist
                var qtyReceived = request.getSublistValue({
                    group: "custpage_itemsublist",
                    name: "qty",
                    line: i
                });

                // Retrieve item number from the sublist
                var itemNo = request.getSublistValue({
                    group: "custpage_itemsublist",
                    name: "itemno",
                    line: i
                });

                // Load the associated Item Fulfillment record
                var itemFul = record.load({
                    type: record.Type.ITEM_RECEIPT,
                    id: itemReceipt.getValue("itemfulfillment")
                });

                itemFul.setValue("qty"); // Placeholder for setting quantity (incomplete)

                // Find the line in the Item Receipt that matches the item number
                var rowNo = itemReceipt.findSublistLineWithValue({
                    sublistId: "item",
                    fieldId: "itemname",
                    value: itemNo
                });

                if (rowNo != -1) {
                    itemReceipt.selectLine({
                        sublistId: "item",
                        line: rowNo
                    });

                    // Get the current quantity from the Item Receipt
                    var irQty = parseFloat(itemReceipt.getCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity"
                    }));

                    // Compare received quantity with Item Receipt quantity
                    if (irQty != qtyReceived) {
                        bShipmentCorrect = false; // Mark shipment as incorrect if quantities differ

                        // Update the quantity in the Item Receipt
                        itemReceipt.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: qtyReceived
                        });
                        itemReceipt.commitLine({ sublistId: "item" });
                    }
                } else {
                    log.audit("item not found", "The item, " + itemNo + " item was not found.");
                }
            }
            if (!bShipmentCorrect) {
                // TODO: Implement email notification for incorrect shipment
            }
            return bShipmentCorrect;
        }

        /**
         * Retrieves Item Fulfillment data based on the provided transaction ID.
         * @param {string} itemFulfillmentID - The transaction ID of the Item Fulfillment
         * @returns {Array} - Search results containing Item Fulfillment data
         */
        function getItemFulfillmentData(itemFulfillmentID) {
            var type = "ITEMFULFILLMENT";
            var cols = ["internalid", "createdfrom", "tranid", "item", "quantity", "item.displayname", "location", "item.itemid", "status", "entity", "statusRef", "type"];
            var filts = [["tranid", "is", itemFulfillmentID], "AND", ["shipping", "is", "F"], "AND", ["cogs", "is", "F"], "AND", ["taxline", "is", "F"]];

            return sHelper.search(type, cols, filts); // Execute search using helper function
        }

        /**
         * Retrieves the status and type of the record created from the Item Fulfillment (e.g., Transfer Order).
         * @param {string} createdFrom - Internal ID of the created-from record
         * @returns {Object} - Search result containing status and type
         */
        function getCreatedFromRecord(createdFrom) {
            var mySearch = search.create({
                type: "TRANSACTION",
                columns: ["status", "type"],
                filters: [["internalid", "is", createdFrom]]
            }).run().getRange({ start: 0, end: 1 });

            return mySearch[0];
        }

        /**
         * Retrieves the creator of the Item Fulfillment and their email address.
         * Uses systemNotes to get the user ID and looks up the email from the employee record.
         * @param {string} itemFulfillmentID - The transaction ID of the Item Fulfillment
         * @returns {Object|null} - Object with creator's name and email, or null if not found
         */
        function getItemFulfillmentCreator(itemFulfillmentID) {
            var formattedIFNumber = formatIFNumber(itemFulfillmentID); // Format the ID for consistency
            log.debug("itemFulfillmentID", itemFulfillmentID);
            var itemfulfillmentSearchObj = search.create({
                type: "itemfulfillment",
                settings: [{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                [
                    ["type","anyof","ItemShip"], 
					 "AND", 
                    ["internalidnumber","equalto",itemFulfillmentID], 
                    "AND", 
                    ["mainline","is","T"], 
                    "AND", 
                    ["systemnotes.type","is","T"]
                ],
                columns:
                [
                    search.createColumn({
                        name: "name",
                        join: "systemNotes",
                        label: "Set by"
                    })
                ]
            });

            var searchResults = itemfulfillmentSearchObj.run().getRange({ start: 0, end: 1 });
            log.debug("searchResults", searchResults);
            if (searchResults.length > 0) {
                var userId = searchResults[0].getValue({name: "name", join: "systemNotes"});
                log.debug("userId", userId);
                try {
                    // Load the employee record to get the email
                    var employeeRec = record.load({
                        type: record.Type.EMPLOYEE,
                        id: userId
                    });
                    var creatorEmail = employeeRec.getValue({ fieldId: 'email' }) || null;
                    log.debug("creatorEmail", creatorEmail);
                    return {
                        creatorName: userId, // In systemNotes, 'name' is typically the user ID
                        creatorEmail: creatorEmail
                    };
                } catch (e) {
                    log.error("Error loading employee record", "User ID: " + userId + ", Error: " + e.message);
                    return {
                        creatorName: userId,
                        creatorEmail: null
                    };
                }
            }
            log.debug("No search results for Item Fulfillment creator", "tranid: " + formattedIFNumber);
            return null;
        }

        /**
         * Sets up the search form for entering an Item Fulfillment number.
         * @param {Object} form - The Suitelet form object
         * @param {string} [msg] - Optional error message to display
         */
        function setupSearchForm(form, msg) {
            var field = form.addField({
                id: "custpage_item_fulfillment_number",
                type: "TEXT",
                label: "IF Number:"
            });

            field.updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
            });

            // Add search button to trigger Item Fulfillment lookup
            form.addButton({
                id: 'custpage_searchitemful',
                label: 'Search',
                functionName: 'SearchIF'
            });

            // Inject client script for search functionality
            var fileContents = file.load(fHandler.Item_Received_CS).getContents();
            var field = form.addField({
                id: 'custpageinjectcode',
                type: 'INLINEHTML',
                label: 'Inject Code'
            });
            field.defaultValue = "<script>" + fileContents + "</script>";

            // Display error message if provided
            if (msg) {
                var field = form.addField({
                    id: 'custpage_does_not_exists',
                    type: 'INLINEHTML',
                    label: 'Inject Code'
                });
                form.title = titleText + " - Received";
                field.defaultValue = "<script>" + msg + "</script>";
            }
            form.title = titleText + " - Search";
        }

        /**
         * Sets up the form to display Item Fulfillment details and allow receipt creation.
         * @param {Object} formTemp - The Suitelet form object
         * @param {Object} itemFulfillment - Loaded Item Fulfillment record
         * @param {boolean} tfoStatus - Transfer Order status (received or not)
         * @param {string} itemFulfillmentID - Item Fulfillment transaction ID
         */
        function setupItemFulFilForm(formTemp, itemFulfillment, tfoStatus, itemFulfillmentID) {
            // Create sublist for displaying shipment details
            var sublist = formTemp.addSublist({
                id: 'custpage_itemsublist',
                type: serverWidget.SublistType.LIST,
                label: 'Shipment Details'
            });

            // Hidden field for Transfer Order ID
            var tranOrderIDField = formTemp.addField({
                id: "transferordernumber",
                type: "text",
                label: "Transfer Order ID:"
            });
            tranOrderIDField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            // Hidden field for Item Fulfillment ID
            var ifIdField = formTemp.addField({
                id: "itemfulfillmentid",
                type: "text",
                label: "Item Fulfillment ID:"
            });
            ifIdField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            // Add fields to the sublist
            var qty = sublist.addField({
                id: 'qty',
                type: serverWidget.FieldType.TEXT,
                label: 'Qty'
            });

            sublist.addField({
                id: 'itemno',
                type: serverWidget.FieldType.TEXT,
                label: 'Item Number'
            });

            sublist.addField({
                id: 'description',
                type: serverWidget.FieldType.TEXT,
                label: 'Description'
            });

            // Add field for reporting issues
            var issue = formTemp.addField({
                id: 'custpage_issues',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'Report a Problem'
            });
            issue.updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
            });

            var itemFulExists = false;
            var lines = itemFulfillment.getLineCount({ sublistId: "item" });
            log.debug("lines", lines);

            // Populate sublist with Item Fulfillment line data
            for (var i = 0; i < lines; i++) {
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

            var shipStatus = dmHelper.formatValue(itemFulfillment.getValue("status")); // Get shipment status

            ifIdField.defaultValue = itemFulfillment.id.toString();
            var createdFrom = itemFulfillment.getValue("createdfrom");
            tranOrderIDField.defaultValue = createdFrom;

            // Display appropriate buttons/messages based on shipment status
            if (shipStatus === "SHIPPED") {
                if (!tfoStatus) {
                    formTemp.addSubmitButton({
                        label: 'Shipment Received'
                    });
                } else {
                    var field = formTemp.addField({
                        id: 'custpageinjectcode',
                        type: 'INLINEHTML',
                        label: 'Inject Code'
                    });
                    formTemp.title = titleText + " - Received";
                    field.defaultValue = "<script>" + cHelper.displayMessageOnLoad("This order has already been marked as received.") + "</script>";
                }
            } else {
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

        var lineBreak = "<br/>"; // HTML line break for email formatting

        /**
         * Sends an email with reported issues, including the Item Fulfillment creator in recipients.
         * @param {Object} itemFulfil - Loaded Item Fulfillment record
         * @param {Object} tranOrd - Loaded Transfer Order record
         * @param {string} issues - User-reported issues
         * @param {string} itemReceiptNumber - Item Receipt transaction number
         * @param {string} itemFulfillmentID - Item Fulfillment transaction ID
         */
        function submitIssues(itemFulfil, tranOrd, issues, itemReceiptNumber, itemFulfillmentID) {
            var tfo = tranOrd.getText("tranid"); // Transfer Order number
            var ter = tranOrd.getText("custbody_osm_territory"); // Territory
            var ifNo = itemFulfil.getText("tranid"); // Item Fulfillment number
            var headers = ["Item", "Description", "Qty"]; // Email table headers

            // Build email table content from Item Fulfillment lines
            var lineCount = itemFulfil.getLineCount({ sublistId: "item" });
            var message = "";
            for (var i = 0; i < lineCount; i++) {
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
            }
            message = emHelper.emailHeaderString(headers) + message;
            message += emHelper.emailFooterString(message);

            // Construct email body
            var subj = 'Transfer Order Shipment issue';
            var msg = "<b>Transfer Order: </b>" + tfo + lineBreak;
            msg += "<b>Item Fulfillment: </b>" + ifNo + lineBreak;
            msg += "<b>Item Receipt: </b>" + (itemReceiptNumber || "Not Available") + lineBreak;
            msg += "<b>Territory: </b>" + ter + lineBreak;
            msg += "<b>Issues: </b><br/>" + issues + lineBreak + lineBreak;

            // Get default email recipients and split comma-separated string
            var emailAddress = cHelper.getScriptParameterValue("custscript_osm_item_received_email");
            log.debug("rawEmailAddress", { value: emailAddress, type: typeof emailAddress });
            var recipients = [];
            if (emailAddress && typeof emailAddress === 'string') {
                recipients = emailAddress.split(',').map(function(email) { return email.trim(); });
            } else {
                log.error("Invalid emailAddress", { value: emailAddress, type: typeof emailAddress });
            }
            log.debug("recipientsBeforeFilter", recipients);
            var creatorInfo = getItemFulfillmentCreator(itemFulfillmentID);
            log.debug("creatorInfo", creatorInfo);

            // Add creator's email if available
            if (creatorInfo && creatorInfo.creatorEmail) {
                recipients.push(creatorInfo.creatorEmail);
            }

            // Filter out any empty or invalid email addresses
            recipients = recipients.filter(function(email) {
                var isValid = email && typeof email === 'string' && email.indexOf('@') !== -1;
                if (!isValid) {
                    log.debug("Invalid email skipped", email);
                }
                return isValid;
            });
            log.debug("recipients", recipients);

            // Convert recipients array to comma-separated string
            var recipientsString = recipients.join(',');
            log.debug("Sending email with recipients", recipientsString);

            // Send email with issues
            emHelper.sendEmailToEmailAddress(subj, msg + "<br/><br/>" + message, recipientsString, false, {
                transactionId: itemFulfil.id.toString()
            });
        }

        /**
         * Transforms a Transfer Order to an Item Receipt and handles issue reporting.
         * @param {string} transferOrderID - Internal ID of the Transfer Order
         * @param {string} itemFulfillmentID - Internal ID of the Item Fulfillment
         * @param {Object} request - Suitelet request object
         * @returns {Object} - Contains the Item Receipt record and its transaction number
         */
        function transformToItemReceipt(transferOrderID, itemFulfillmentID, request) {
            var issues = request.parameters["custpage_issues"].trim();
            log.debug("issues", issues);
            var itemReceiptNumber = null;

            // Transform Transfer Order to Item Receipt
            var itemReceipt = record.transform({
                fromType: record.Type.TRANSFER_ORDER,
                fromId: transferOrderID,
                toType: record.Type.ITEM_RECEIPT,
                isDynamic: true,
                defaultValues: {
                    itemfulfillment: itemFulfillmentID
                }
            });

            // Set custom field for vendor shipper document
            itemReceipt.setValue("custbody_vendor_shipper_document_no", "Field Receipt acknowledged by hand held");
            var itemReceiptId = itemReceipt.save();
            log.debug('Item receipt internal id', itemReceiptId);

            // Load Item Receipt to get transaction number
            var itemReceiptRecord = record.load({
                type: record.Type.ITEM_RECEIPT,
                id: itemReceiptId
            });
            itemReceiptNumber = itemReceiptRecord.getValue({
                fieldId: 'tranid'
            });
            log.debug('Item receipt number', itemReceiptNumber);

            // Send email if issues are reported
            if (issues) {
                var tranOrd = record.load({
                    id: transferOrderID,
                    type: "TRANSFERORDER"
                });

                var itemFulfil = record.load({
                    id: itemFulfillmentID,
                    type: "ITEMFULFILLMENT"
                });
                submitIssues(itemFulfil, tranOrd, issues, itemReceiptNumber, itemFulfillmentID);
            }

            return { itemReceipt: itemReceipt, itemReceiptNumber: itemReceiptNumber };
        }

        /**
         * Formats the Item Fulfillment ID to ensure it starts with "IF".
         * @param {string} itemFulfillmentID - The Item Fulfillment transaction ID
         * @returns {string} - Formatted ID in uppercase
         */
        function formatIFNumber(itemFulfillmentID) {
            if (itemFulfillmentID && (itemFulfillmentID || "").toUpperCase().indexOf("IF") == -1) {
                itemFulfillmentID = "IF" + itemFulfillmentID;
            }
            return (itemFulfillmentID || "").toUpperCase();
        }

        /**
         * Generates the Suitelet form based on the request context.
         * @param {Object} context - Suitelet context object
         * @param {Object} form - The Suitelet form object
         * @returns {boolean} - False if the Item Fulfillment is invalid
         */
        function generateForm(context, form) {
            var itemFulfillmentID = formatIFNumber(context.request.parameters["tranid"]);

            if (itemFulfillmentID) {
                var msg = itemFulfillmentID;
                var mySearch = getItemFulfillmentData(itemFulfillmentID);
                if (mySearch.length <= 0) {
                    msg += " does not exists. Please try again.";
                    setupSearchForm(form, cHelper.displayMessageOnLoad(msg));
                    return false;
                }

                // Load Item Fulfillment record
                var itemFulfil = record.load({
                    id: mySearch[0]["internalid"],
                    type: "ITEMFULFILLMENT"
                });

                var results = mySearch;
                if (results.length > 0) {
                    var createdFrom = results[0]["createdfrom"];
                    var recCreatedFrom = getCreatedFromRecord(createdFrom);
                    var type = recCreatedFrom.getValue("type");
                    var tfoStatus = recCreatedFrom.getValue("status") == "received";

                    // Display appropriate form based on record type
                    if (type == "TrnfrOrd") {
                        setupItemFulFilForm(form, itemFulfil, tfoStatus, itemFulfillmentID);
                    } else {
                        msg += " is not a transfer order. Please try again.";
                        setupSearchForm(form, cHelper.displayMessageOnLoad(msg));
                    }
                } else {
                    msg += " does not exists. Please try again.";
                    setupSearchForm(form, cHelper.displayMessageOnLoad(msg));
                }
            } else {
                setupSearchForm(form);
            }
        }

        /**
         * Creates an Item Receipt from the submitted form data.
         * @param {Object} context - Suitelet context object
         * @param {Object} form - The Suitelet form object
         */
        function createItemReceipt(context, form) {
            var request = context.request;
            var transferOrderID = request.parameters["transferordernumber"];

            if (transferOrderID) {
                try {
                    var itemFulfillmentID = request.parameters["itemfulfillmentid"].toString();
                    var result = transformToItemReceipt(transferOrderID, itemFulfillmentID, request);
                    var itemReceiptNumber = result.itemReceiptNumber;

                    log.debug('Item receipt number', itemReceiptNumber);

                    // Display success message
                    var field = form.addField({
                        id: "custpage_item_fulfillment_number",
                        type: "HELP",
                        label: "<span style='color: red; font-weight: bold; font-size: 16px;'>Item Receipt " + itemReceiptNumber + " created Successfully!</span>"
                    });

                    field.updateLayoutType({
                        layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
                    });
                } catch (err) {
                    if (err.message.indexOf('not initialize') > 0 || err.message.indexOf('enter at least one line') > 0) {
                        throw 'This fulfillment has already been processed';
                    } else {
                        throw err.message;
                    }
                }
            }
        }

        /**
         * Main entry point for the Suitelet, handles GET and POST requests.
         * @param {Object} context - Suitelet context object
         */
        function onRequest(context) {
            var response = context.response;
            var form = serverWidget.createForm({ title: titleText });

            if (context.request.method === "GET") {
                generateForm(context, form);
            } else {
                createItemReceipt(context, form);
            }
            response.writePage(form);
        }

        return {
            onRequest: onRequest
        }
    });