/**
 * Created by screnshaw on 6/13/2017.
 */
/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope Public
 * @NAmdConfig  /SuiteScripts/Source/Libs/helperConfig.json
 * 
 * Version History:
 *
 * | Version | Date       | Author               | Remarks                                  |
 * |---------|------------|----------------------|------------------------------------------|
 * | 1.00    | 2025-02-27 | Yogesh P Bhurley     |Added function to pull job details based on request parameters       |
 */



define(["./ous_rl_getHelper", 'N/record', 'N/search', "N/render", "errorHelper", "searchHelper", "N/http",
        "N/https", "searchHandler", "emailHelper", "N/url", "N/runtime", "commonHelper", "N/sftp", "N/file",
        "fileHandler", "encodeHelper", "moment", "dmHelper", "sftpHandler", "mtProxyConfig", "lodash", "sftpHandler"
        , "/SuiteScripts/Source/Implementation/Integrations/CLC Lodging/osm_convert_clc_data", "ramda"],

    /**
     * @param sHelper
     * @param {record} record
     * @param {search} search
     * @param render
     * @param eHelper
     * @param searchHelper
     */
    function (sHelper, record, search, render, eHelper, searchHelper, http,
              https, sHandler, emHelper, url, runtime, cmHelper, ftp, file,
              fiHandler, encHelper, moment, dmHelper, sftpHandler, mtProxyConfig, lodash, sftp, convertCLC, ramda)
    {
        // var test = true;

        var g_columns = "";
        var g_filters = "";
        var g_type = "";
        var g_fieldsToGetText = "";

        /**
         * @requires N/ous_rl_integration_searchHelper
         */
        /**
         * Sets up the customer search
         * @returns {*}
         */
        function customerSearch()
        {
            var mySearch;
            mySearch = search.create({
                type: record.Type.CUSTOMER,
                columns: [{name: "internalid", label: "id"}, "entityid",
                    {
                        name: "formulatext",
                        label: "parent",
                        formula: "Substr ({parent}, 1,instr({parent},' ') - 1)"
                    },
                    {
                        name: "companyname",
                        label: "altname"
                    }, "custentity_osmose_customer_short_name", "category", "isinactive"]
                // filters:[["entityId", "IS", "1000622" ]]
            });
            if (test)
            {
                mySearch.filters.push(search.createFilter({
                    name: "entityid",
                    operator: "HASKEYWORDS",
                    values: "Weyerhaeuser"
                }));
            }
            g_fieldsToGetText = "parent, category";
            return mySearch;
        }

        /**
         * Sets up the contactd search
         * @returns {*}
         */
        function contactCustomerSearch()
        {
            mySearch = search.create({
                type: record.Type.CONTACT,
                columns: [{
                    name: "internalid",
                    label: "ContactID"
                }, "externalid", "comments", "address1", "address2", "address3", "city", "state", "zipcode", "country",
                    "entityid", "contactrole", "addresslabel", "entityid", {
                        name: "entityid",
                        join: "customer",
                        label: "customerID"
                    }
                ],
                filters: [
                    [["type", search.Operator.ANYOF, "CustJob"]]
                ]
            });
            //Use GetText on these columns
            g_fieldsToGetText = "contactrole";
            return mySearch;
        }

        /**
         * Sets up the employee search
         * @returns {*}
         */
        function employeeCustomerSearch()
        {
            return search.create({
                type: record.Type.CUSTOMER,
                columns: [{name: "entityid", label: "CustomerID"}, {
                    name: "formulatext",
                    formula: "{salesrep.firstname} || ' ' || {salesrep.middlename} || ' ' || {salesrep.lastname}",
                    label: "Name"
                }, {name: "entityid", join: "salesrep", label: "entityid"}]
            });
        }

        /**
         * Sets up the customer search
         * @returns {*}
         */
        function customerAddressSearch()
        {
            var mySearch;
            mySearch = search.create({
                type: record.Type.CUSTOMER,
                columns: [{"name": "entityid", "label": "customerID"}, "address.addressee", "address.address1",
                    "address.address2", "address.address3", "address.isdefaultshipping", "address.isdefaultbilling", "address.addresslabel",
                    {"name": "internalid", "join": "address", "label": "addressID"}, {
                        "name": "address",
                        "join": "address",
                        "label": "fullAddress"
                    },
                    "address.city", "address.state", "address.zipcode", "address.country"]
            });
            return mySearch;
        }

        /**
         *Creates customer search and adds last modified filter if needed.
         * @param lastModifiedDate
         * @param searchType
         * @returns {*}
         */
        function createSearchOld(lastModifiedDate, searchType)
        {
            var filter;

            //This tells you which type of search is going to run
            var mySearch;
            if (searchType == "customer")
            {
                mySearch = customerSearch();
            }
            else if (searchType == "contact")
            {
                mySearch = contactCustomerSearch();
            }
            else if (searchType == "employee")
            {
                mySearch = employeeCustomerSearch();
            }
            else if (searchType == "address")
            {
                mySearch = customerAddressSearch();
            }

            //Adds last modified date filter to customer/contact if passed in
            if (Date.parse(lastModifiedDate))
            {
                filter = search.createFilter({
                    name: "lastmodifieddate",
                    operator: search.Operator.ONORAFTER,
                    values: lastModifiedDate
                });

                mySearch.filters.push(filter);
            }
            return mySearch;
        }

        /**
         *Creates customer search and adds last modified filter if needed.
         * @param lastModifiedDate
         * @param searchType
         * @returns {*}
         */
        function createSearch(lastModifiedDate)
        {
            var mySearch = search.create({
                columns: g_columns,
                filters: g_filters,
                type: g_type
            });

            // var filter;
            // filter = search.createFilter({
            //     name: "entityid",
            //     operator: "HASKEYWORDS",
            //     values: "Weyerhaeuser"
            // });

            // //Adds last modified date filter to customer/contact if passed in
            // if (Date.parse(lastModifiedDate)) {
            //     filter = search.createFilter({
            //         name: "lastmodifieddate",
            //         operator: search.Operator.ONORAFTER,
            //         values: lastModifiedDate
            //     });
            //
            //     mySearch.filters.push(filter);
            // }
            return mySearch;
        }
		
		
        /**
         * Get all customer's based on the lastModified Date if passed
         *
         * @param {Object} requestParams - Parameters from HTTP request URL; parameters will be passed into function as an Object (for all supported content types)
		 * @param {string} context.searchType - The type of record to return (e.g., Customer, Contacts, Job).
		 * @param {string} [context.startDate] - The start date for job search.
		 * @param {string} [context.endDate] - The end date for job search.
         * @returns {string | Object} HTTP response body; return string when request Content-Type is 'text/plain'; return Object when request Content-Type is 'application/json'
         * @since 2015.1
         */
        function doGet(context)
        {
           
            //
            // if(test)
            //     return JSON.stringify("hello");
            var lastModifiedDate = context.lastModifiedDate;    //Date customer was last modified
            var searchType = context.searchType;    //Which record type do you wish to return ex: Customer/Contacts
            test = context.test;

            if (searchType == null | searchType == "")
            {
                return JSON.stringify({error: "Please specify which type of search you are performing"})
            }
			
			if (test)
			{
				var filter = search.createFilter({
					name: "entityid",
					operator: "HASKEYWORDS",
					values: "Weyerhaeuser"
				});
			}

			
			var mySearch;
			if (test)
			{
				g_columns = context.columns ? JSON.parse(context.columns) : "";
				g_filters = context.filters ? JSON.parse(context.filters) : "";
				// g_filters = context.filters || "[]";
				g_type = context.searchType || "";
				g_fieldsToGetText = context.fieldsToGetText || "";
				var includeJoinName = context.includeJoinName || false;

				mySearch = createSearchTest(null, searchType).run();

			}
			else
			{
				//Creates search and adds filter if lastModifiedDate was passed.
				mySearch = createSearchOld(lastModifiedDate, searchType).run();
			}

			// mySearch = createSearch(lastModifiedDate, searchType).run();
			//Creates the return object of customers and returns it
			return JSON.stringify(sHelper.returnSearchObject(mySearch, g_fieldsToGetText, includeJoinName));
		}
          

        /**
         * Loads a pre saved search.
         * @returns {*}
         */
        function loadSearch(searchId)
        {

            var mySearch = search.load({
                id: searchId
            });

            return mySearch;
        }

        function ConvertToCSV(objArray)
        {
            var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
            var str = '';

            for (var i = 0; i < array.length; i++)
            {
                var line = '';
                for (var index in array[i])
                {
                    if (line != '') line += ','

                    line += array[i][index];
                }

                str += line + '\r\n';
            }

            return str;
        }

        function JSONToCSVConvertor(JSONData, ReportTitle, ShowLabel)
        {
            //If JSONData is not an object then JSON.parse will parse the JSON string in an Object
            var arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;

            var CSV = '';
            //Set Report title in first row or line

            CSV += ReportTitle;// + '\r\n\n';

            //This condition will generate the Label/Header
            if (ShowLabel)
            {
                var row = "";

                //This loop will extract the label from 1st index of on array
                for (var index in arrData[0])
                {

                    //Now convert each value to string and comma-seprated
                    row += index + ",";
                }

                row = row.slice(0, -1);

                //append Label row with line break
                CSV += row + '\r\n';
            }

            //1st loop is to extract each row
            for (var i = 0; i < arrData.length; i++)
            {
                var row = "";

                //2nd loop will extract each column and convert it in string comma-seprated
                for (var index in arrData[i])
                {
                    row += "'" + arrData[i][index] + "',";
                }

                row.slice(0, row.length - 1);

                //add a line break after each row
                CSV += row + '\r\n';
            }

            if (CSV == '')
            {
                alert("Invalid data");
                return;
            }

            return CSV;


            //Generate a file name
            var fileName = "MyReport_";
            //this will remove the blank-spaces from the title and replace it with an underscore
            fileName += ReportTitle.replace(/ /g, "_");
            //Initialize file format you want csv or xls
            var uri = 'data:text/csv;charset=utf-8,' + escape(CSV);
            return uri;
            // Now the little tricky part.
            // you can use either>> window.open(uri);
            // but this will not work in some browsers
            // or you will not get the correct file extension

            //this trick will generate a temp <a /> tag
            var link = document.createElement("a");
            link.href = uri;

            //set the visibility hidden so it will not effect on your web-layout
            // link.style = "visibility:hidden";
            // link.download = fileName + ".csv";
            return fileName + ".csv";

            //this part will append the anchor tag and remove it after automatic click
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function addFilterToSavedSearch(filters, filter)
        {
            return filters.push(search.createFilter({
                name: filter[0],
                operator: filter[1],
                values: filter.splice(2)
            }));
        }

        function setupAdditionalFilters(filters)
        {
            if (filters)
            {
                if (filters[0].constructor == Array)
                {
                    for (var i = 0; i < filters.length; i++)
                    {
                        var filter = filters[i];
                        //Ignore the AND/or that joins multiple filters.
                        if (Array.isArray(filter))
                        {
                            addFilterToSavedSearch(filters, filter);
                        }
                    }
                }
                else
                {
                    addFilterToSavedSearch(filters, g_filters);
                }
            }
            return filters;
        }


        function setupSearch(data)
        {
            var condition = {property: "type", value: "CUSTOMER_NUMBER"};
            var cols = ["internalid", "entityid"];
            var filters = searchHelper.createFilterComplex1(data, [], "fields", "value", "entityid", "is", condition);
            var customerData = searchHelper.search("entity", cols, filters);
            // return customerData;


            log.debug("filters", filters);
            // var entityData = seHelper.search("entity", cols, filters, condition);
            var cols = ["internalid", "entityid"];
            var filters = searchHelper.createFilterComplex1(data, [], "fields", "value", "entityid", "contains");


            log.debug("filters", filters);
            var entityData = searchHelper.search("entity", cols, filters);
            return entityData
            // var items = [];
            // data.sublists.item.filter(function (element) {
            //     if (element["type"] == "item")
            //     {
            //         items.push(element["value"])
            //     }
            //     return true;
            // });

            var condition = {
                property: "type",
                value: "ITEM_NUMBER"
            };

            cols = ["internalid", "itemid"];
            filters = searchHelper.createFilterComplex2(data, [], "sublists", "item", "value", "itemid", "is", condition);
            log.debug("filters", filters);
            var itemData = searchHelper.search("item", cols, filters);
            log.debug("entitydata", itemData);

            // return filters
            return {entityData: entityData, itemData: itemData};
            // seHelper.createFilter2(asItem, list, "approver", "is", "Approver");
        }

        function testJournalEntry()
        {
            var myRec = record.create({type: "journalentry", isDynamic: true});
            myRec.selectNewLine({
                sublistId: "line"
            });

            myRec.setValue("subsidiary", 2);
            // myRec.setValue("entity", 35653)

            myRec.setCurrentSublistValue({
                sublistId: "line",
                fieldId: "account",
                value: 2099
            });

            myRec.setCurrentSublistValue({
                sublistId: "line",
                fieldId: "debit",
                value: 200
            });
            myRec.commitLine("line");


            myRec.selectNewLine({
                sublistId: "line"
            });

            myRec.setCurrentSublistValue({
                sublistId: "line",
                fieldId: "account",
                value: 2099
            });

            myRec.setCurrentSublistValue({
                sublistId: "line",
                fieldId: "credit",
                value: 200
            });
            myRec.commitLine("line");

            // var sessionObj = runtime.getCurrentSession();
            // sessionObj.set({
            //     name: "PAYROLL",
            //     value: "PAYROLL"
            // });

            return myRec.save()
        }

        function testJobDataBus()
        {
            var jsonData = [{
                "fields": [{
                    "fieldId": "entity",
                    "getValue": false,
                    "type": "CUSTOMER_NUMBER",
                    "sort": 1,
                    "value": "1005077"
                }, {"fieldId": "subsidiary", "getValue": true, "type": "ID", "sort": 1, "value": "2"}, {
                    "fieldId": "autoname",
                    "type": "OVERRIDE",
                    "sort": 50
                }, {
                    "fieldId": "tranid",
                    "getValue": true,
                    "type": "TRANID",
                    "sort": 1,
                    "value": "INV1035121"
                }, {
                    "fieldId": "job",
                    "getValue": false,
                    "type": "JOB_NUMBER",
                    "sort": 10,
                    "value": ""
                }, {"fieldId": "status", "getValue": true, "type": "STRING", "sort": 20, "value": "Open"}, {
                    "fieldId": "startdate",
                    "getValue": true,
                    "type": "DATETIME",
                    "sort": 30,
                    "value": ""
                }, {"fieldId": "enddate", "getValue": true, "type": "DATETIME", "sort": 40, "value": ""}],
                "sublists": [{
                    "item": [{
                        "fieldId": "item",
                        "getValue": false,
                        "type": "ITEM_NUMBER",
                        "value": "72-020-009-100"
                    }, {
                        "fieldId": "amount",
                        "getValue": true,
                        "type": "CURRENCY",
                        "value": 134.05
                    }]
                }]
            }];
            return setupSearch(jsonData);
            return JSON.stringify(setupSearch(jsonData), null, 2);
        }

        function jsonToCSVPostman(json)
        {
            var fields = Object.keys(json[0]);
            // var replacer = function (key, value)
            var replacer = function (value)
            {
                if (!isNaN(value))
                {
                    value = Number(value);
                }
                return value === null ? '' : value
            };
            var csv = json.map(function (row)
            {
                return fields.map(function (fieldName)
                {
                    // return JSON.stringify(row[fieldName], replacer)
                    return replacer(row[fieldName]);
                }).join(',')
            });
            csv.unshift(fields.join(',')); // add header column

            return csv;
            // csv.join('\r\n')
        }


        /**
         *
         * @param jsonObj
         * @param objProperty
         * @constructor
         */
        function JSONObjToArray(jsonObj, objProperty)
        {
            var list = [];
            jsonObj.map(function (n)
            {
                var value;

                if (!cmHelper.itemExistsInArray(list, n[objProperty]) && n[objProperty])
                {
                    if (n[objProperty])
                    {
                        value = n[objProperty].trim();
                    }
                    else
                    {
                        value = n[objProperty];
                    }
                    list.push(value);
                }
            });
            return list;
        }

        function groupByProperties(arr, properties)
        {
            // var arr = this;
            var groups = [];

            if (!Array.isArray(properties))
            {
                properties = [properties];
            }

            for (var i = 0, len = arr.length; i < len; i += 1)
            {
                var obj = arr[i];
                if (groups.length == 0)
                {
                    groups.push([obj]);
                }
                else
                {
                    var equalGroup = false;
                    for (var a = 0, glen = groups.length; a < glen; a += 1)
                    {
                        var group = groups[a];
                        var equal = true;
                        var firstElement = group[0];
                        properties.forEach(function (property)
                        {
                            if (firstElement[property] !== obj[property])
                            {
                                equal = false;
                            }

                        });
                        if (equal)
                        {
                            equalGroup = group;
                        }
                    }
                    if (equalGroup)
                    {
                        equalGroup.push(obj);
                    }
                    else
                    {
                        groups.push([obj]);
                    }
                }
            }
            return groups;
        };


        function getPrevFileData(fileName)
        {
            var prevFileData = "";
            try
            {
                log.debug("1", 1);
                var prevFile = file.load({
                    id: "Script Saved Files/" + fileName
                });
                s
                prevFileData = prevFile.getContents();
                log.debug("ahhhhhhhhhhh", encHelper.decrypt(prevFileData));
                return encHelper.decrypt(prevFileData);
            }
            catch (e)
            {
                var myErr = eHelper.getError(e);
                // log.debug("e", myErr)
                if (myErr.name != "RCRD_DSNT_EXIST" && myErr.message != "Malformed UTF-8 data")
                {
                    log.debug("myErr", myErr);
                    throw myErr;
                }
                return prevFileData
            }
        }

        function groupBy(data, liGrpElem, index, newList)
        {
            if (!newList)
            {
                newList = [];
            }
            if (dmHelper.isNilOrEmpty(index))
            {
                index = 0;
            }
            else
            {
                index += 1
            }

            var grpElem = liGrpElem[index];

            lodash.chain(data).groupBy(grpElem).map(function (elem, b)
            {
                if (index < liGrpElem.length)
                {
                    return groupBy(elem, liGrpElem, index, newList);
                }
                else
                {
                    newList.push(elem);
                    return elem
                }
            }).value();

            return newList;
        }

        function groupByEmployeeAndDate(list)
        {
            var myArr = [];

            lodash.chain(list).groupBy("name").map(function (v, i)
            {
                return lodash.chain(v).groupBy("age").map(function (a, b)
                {
                    myArr.push(a);
                    return a
                }).value()
            }).value();
            return myArr;
        }

        function loadFile(fileName)
        {
            var fileData = "";
            try
            {
                var clcFile = file.load({
                    id: "Script Saved Files/" + fileName
                });
                fileData = clcFile.getContents();
                return encHelper.decrypt(fileData);
            }
            catch (e)
            {
                var myErr = eHelper.getError(e);
                if (myErr.name != "RCRD_DSNT_EXIST" && myErr.message != "Malformed UTF-8 data")
                {
                    throw myErr;
                }
                return fileData
            }
        }

        var testFunctions = function (data)
        {
            /// ###################### HCM IMPORT ####################################################
            if (data.results)
            {
                data = data.results;
            }
            var newArray = [];
            while (data.length)
            {
                newArray.push(data.splice(0, 600));
            }
            var date = dmHelper.parseDateTime(moment());
            for (var i in newArray)
            {
                var rec = record.create({
                    type: "customrecord_osm_hr_payroll_json_data"
                });

                rec.setValue("custrecord_osm_hr_payroll_json_data", JSON.stringify(newArray[i]));
                rec.setValue("custrecord_hr_payroll_date_time", moment().toDate());
                rec.setValue("custrecord_osm_hr_json_not_processed", newArray[i].length);
                rec.setValue("name", date.toString());
                rec.save();
            }

            return "HCM Import Payroll Data Complete.";
            /// ###################### END HCM IMPORT ################################################

            return "hello";
            return convertCLC.convertData(loadFile("clcdata.csv"));

            // var str = secret.token.public + "------" + secret.token.secret + " _---- " + secret.realm;
            // return str;
            // return secret.token.secret;

            var fileName = "Salary_Activity_Output.csv";
            var downloadedFile = sftp.getFileData(sftp.KRONOS_PROD, "/WIM_OUT", fileName);
            return downloadedFile;
            // var env = runtime.envType;
            // if (runtime.accountId == "4268509_SB2")
            // {
            //     env = "UAT"
            // }
            // return env;
            // var fileName = "clcdata.csv";
            //
            // var clcData = convertCLC.convertData(loadFile(fileName));
            // return clcData;

            // var myObj = [
            //     {name: "Shane", age: 5, position: "bla"},
            //     {
            //         name: "Shane",
            //         age: 5,
            //         position: "blame"
            //     },
            //     {name: "Tom", age: 7, position: "bla"}
            // ];
            //
            // return groupBy(myObj, ["name", "age", "position"])
            // return groupByEmployeeAndDate(myObj);

            // return emHelper.get.KRONOS_TIME_IMPORT();
            // return emHelper.get.DEVELOPER();
            // var myEmail = new emHelper.Email("test", "test", emHelper.get.ASSET_ORDER_ERROR());
            // myEmail.sendEmail();

            // emHelper.sendEmail("test", "test", emHelper.get.ASSET_ORDER_ERROR());
            // return "hi";
            // return emHelper.get.ASSET_ORDER();

            // return emHelper.sendEmail("test", "body", emHelper.get.KRONOS_TIME_IMPORT());

            // var pickingTicketEmail = new emHelper.Email();
            // pickingTicketEmail.subject = "testing email";
            // pickingTicketEmail.recipients = emHelper.get.KRONOS_TIME_IMPORT();
            // pickingTicketEmail.body = "hello body";
            //
            // return pickingTicketEmail.sendEmail();
            //
            // return emHelper.get.KRONOS_TIME_IMPORT();
            // return sftpHandler.KRONOS
            // return cmHelper.JSONToCSVConvertor(mtProxyConfig.getProxyResults("api/ERP/GetEmployeeDataForKronos"), "", true);

            var results = mtProxyConfig.getProxyResults("api/ERP/GetEmployeeDataForKronos");
            results = cmHelper.JSONToCSVConvertor(results, "", true);
            return results;
            // return sftpHandler.sftpUpload(sftpHandler.KRONOS_PROD, results, "CSV", "Person_Import.csv", "/WIM_IN", true);

            // return "hi";
            var downloadedFile = sftpHandler.getFileData(sftpHandler.KRONOS_PROD, "/WIM_IN", "Person_Import.csv");
            return downloadedFile;

            // var results = mtProxyConfig.getProxyResults("api/ERP/GetEmployeeDataForKronos");
            // results = cmHelper.JSONToCSVConvertor(results, "", true);
            return sftpHandler.getFileData(sftpHandler.KRONOS_PROD, results, "CSV", "Person_Import.csv", "/WIM_IN", true);
            return results;
            // emHelper.sendEmail("test", "TESTING EMAIL", emHelper.get.DEVELOPER());
            // return emHelper.get.ASSET_ORDER();
            // return getPrevFileData("Salary_Activity_Output.csv");
            // return dmHelper.formatValue("hi");
            // return "hi";
            // return emHelper.get.ULTIPRO_KRONOS_BRIDGE();
            // return mtProxyConfig.Methods.LaborManagerData
            // return mtProxyConfig.getProxyResults(mtProxyConfig.Methods.LaborManagerData);
            // try
            // {
            //     var myRec = record.load({
            //         id: 953658,
            //         type: record.Type.PURCHASE_REQUISITION,
            //         isDynamic:false
            //     });
            //     myRec.setValue("nextapprover", 37029);
            //     myRec.save();
            //     return myRec.getValue("nextapprover");
            // }
            // catch (e)
            // {
            //     return e
            // }

            var downloadedFile = dmHelper.csvToJSON(sftpHandler.getFileData(sftpHandler.KRONOS_PROD, "/WIM_IN", "Person_Import.csv"));
            return downloadedFile;
            // var downloadedFile = sftpHandler.getFileData(sftpHandler.KRONOS_PROD, "/WIM_OUT", "Activities_Output.csv");
            // return downloadedFile;
            // return mtProxyConfig.getProxyResults(mtProxyConfig.Methods.LaborLocationDataForKronos);
            // return "hi";
            // var renderer = render.create();
            // renderer.templateContent = xmlTemplateFile.getContents();
            // renderer.addRecord('grecord', record.load({
            //     type: record.Type.TRANSACTION,
            //     id: 257226
            // }));
            // return renderer.renderAsPdf();

            // return render.pickingTicket({
            //     entityId: Number(257226),
            //     printMode: render.PrintMode.PDF,
            //     formId:106
            // });

            // var devs = emHelper.get.DEVELOPER();
            // return dmHelper.validateEmail(dmHelper.splitTrim(devs)[0]);
            // return dmHelper.validateEmail(devs[0]);

            // var myEmail = new emHelper.Email("HI", "HELLO", emHelper.get.DEVELOPER());
            // myEmail.sendEmail();
            // return "hasdfi";
            // myEmail.addAttachment(257226, myEmail.printType.PICKING_TICKET);

            // myEmail.addAttachment(257226);
            // myEmail.addAttachment(184959);
            // // return myEmail.attachments;
            // // return myEmail.getAttachments()[0];
            // // return myEmail.attachments;
            // myEmail.sendEmail();
            //
            // return "hi";
            // emHelper.sendEmail("Search", JSON.stringify(results));
            // var columns = ["internalid"]
            // var filters = ["internalid", "anyof", 39023823];
            // return new 064037.Search("account", columns).toCSV()
            // return "hi";
            // var fileObj = file.create({
            //     name: 'Activities_Output.csv',
            //     description: "Kronos Time Import",
            //     encoding: file.Encoding.GB18030,
            //     fileType: file.Type.CSV,
            //     folder: fiHandler.KRONOS,
            //     contents: encHelper.encrypt('this is me tesasdfasdfasdfasdfting something')
            // });
            //
            // fileObj.save();
            // return encHelper.decrypt(fileObj.getContents());
            //

            // var fileObj = file.create({
            //     name: 'Activities_Output.csv',
            //     fileType: file.Type.CSV,
            //     folder: fiHandler.KRONOS,
            //     contents: ' '
            // });
            // var id = fileObj.save();
            // return id;
            // var columns = ["InternalID", {"name": "entityid", "label": "ID", "join": "custrecord_osm_job_id"},
            //     {
            //         "name": "custrecord_osm_job_id",
            //         "label": "Name",
            //         "formula": "child"
            //     }, {"name": "custrecord_osm_project_id", "label": "Project ID"}
            // ];
            // var projJob = new searchHelper.Search("customrecord_osm_project_job", columns, null, "custrecord_osm_project_id, custrecord_osm_job_id").toList();

            // return projJob;
            // return JSON.stringify(emHelper.get.DEVELOPER());
            // var csvData = projJob.toCSV();
            // return csvData

            // var fileObj = file.create({
            //     name: 'test.csv',
            //     fileType: file.Type.CSV,
            //     contents: csvData
            // });
            //
            // return fileObj.getContents();


            // var fileObj = file.create({
            //     name: 'Kronos/Time Sheet/Activities_Output.csv',
            //     fileType: file.Type.CSV,
            //     contents: ' '
            // });
            // fileObj.folder = -15;
            // var id = fileObj.save();

            // return "hi";
            // var connection = sftpHandler.createConnection(sftpHandler.KRONOS);
            // var connection = ftp.createConnection({
            //     passwordGuid: "8a992c0485544556b1f534f434ab2a57", // references var myPwdGuid
            //     username: 'osmuti-1@osmose.com',
            //     url: 'osmose-xfer.kronos.net',
            //     port: 22,
            //     // directory: 'PROD/WIM_OUT/Activity_Job_Import.csv',
            //     hostKey: "AAAAB3NzaC1yc2EAAAABEQAAAgEAl0NL861xE4yR8avqfrC7PCCEnfY8YRxFWTMq6zF3bdO374ZJNCOBtcH1pTPDmaGhuX1SGAal8pAnd/dh1m4B0nGSDK3eYBd8T3AE0kUob04ZDRWa8xa4iAlKMy1L32vax+X6oR35dX3y2LdGPr0MX6pP3uoqwCtFjhfg17cjevGjD1HoAm9TxMguriGmeeBniFMZxPvXuOijDIVKYtr/I0uoac3YM6OZls9s5fL20EpoPok6XVg80o4pQ9OvyQPgMv6A0+LooEZpY7oQk4u4fW2J0N6lnPB3reZJXdyEpkzdutMFt0n7qPbiNdgjblT2RXXsv/6virZUVhwcn0o4Ntsh9rYoBAhQAvSexmQIF6SdBlqzx4k+/+tllYj/5LE2XJ/NNokTk74wAQHLvLEGGBWm3+AQ6B8cDWKlvL/QBBvdhFZOCgNDWkTSRyqJk8GRF7kRKpBTcm2KCV+6m9TzFJXLIWzyvT3mwiXSnl4CN3Izu5OY0v7XUYRMOt/npasNalVy4SBzM43lgNAAaDs01Zq6Fp/RQADUV3Z9Uh7e9ORPhTVOf+0POqW1i1ay28lkA2kRNzBH1LsmXB+xQPDbkVLfAGS251BxNEOoA+hsfpGZTQjd4bu29iXTslOmXNw9JgnmF0AxKGTFmBDZRrAxwQ6sW/Z/c0tF4EEKKGAiIU8=", // references var myHostKey
            //     hostKeyType: "rsa"
            // });

            // var prevFile = file.load({
            //     id: "SuiteScripts/Activities_Output.csv"
            // });
            //
            //
            // connection.upload({
            //     directory: 'PROD/WIM_OUT',
            //     filename: 'Activities_Output.csv',
            //     file: prevFile,
            //     replaceExisting: true
            // });

            //osmose-xfer.kronos.net ssh-rsa
            // log.debug("connection", connection);

            // var downloadedFile = connection.download({
            //     "directory": "DEV/WIM_OUT",
            //     "filename": "Activities_Output.csv"
            // });
            // return downloadedFile.getContents();

            var connection = sftpHandler.createConnection(sftpHandler.KRONOS);
            var downloadedFile = connection.download({
                "directory": "DEV/WIM_IN",
                "filename": "Labor_Level_Manager.csv"
            });
            return downloadedFile.getContents();
            // var downloadedFile = connection.download({
            //     "directory": "PROD/WIM_IN",
            //     "filename": "Activity_Category_Import.csv"
            // });
            var downloadedFile = connection.download({
                "directory": "PROD/WIM_IN",
                "filename": "Activity_PTO_Import.csv"
            });
            return downloadedFile.getContents()

            var dldContent = downloadedFile.getContents();
            return dldContent;


            var prevFile = file.load({
                id: "SuiteScripts/Activities_Output.csv"
            }).getContents();
            return dldContent

            if (prevFile == dldContent)
            {
                return true;
            }
            else
            {
                return false;
            }

            // var objFile = {
            //     data: downloadedFile.getContents(),
            //     type: downloadedFile.fileType,
            //     name: "Activities_Output.csv",
            //     folder:-15
            // };
            // var myFile = cmHelper.createFile(objFile);
            // myFile.save();

            return myFile;

            var urls = "https://rental5.ultipro.com/services/LoginService";
            var body = '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">   <s:Header>   <a:Action s:mustUnderstand="1">http://www.ultipro.com/services/loginservice/ILoginService/Authenticate</a:Action>  <h:ClientAccessKey xmlns:h="http://www.ultipro.com/services/loginservice">LA1YT</h:ClientAccessKey>    \t    <h:Password xmlns:h="http://www.ultipro.com/services/loginservice">Osmose980BF</h:Password>    \t    <h:UserAccessKey xmlns:h="http://www.ultipro.com/services/loginservice">AOC0SU0000K0</h:UserAccessKey>    \t    <h:UserName xmlns:h="http://www.ultipro.com/services/loginservice">OsmoseAPI</h:UserName>    </s:Header>   <s:Body>     <TokenRequest xmlns="http://www.ultipro.com/contracts" />    </s:Body> </s:Envelope>';
            var header = {"Content-Type": "application/soap+xml", SOAPAction: urls};
            body = '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">	<s:Header>		<a:Action s:mustUnderstand="1">https://rental5.ultipro.com/services/LoginService</a:Action> 		<a:To s:mustUnderstand="1">https://rental5.ultipro.com/services/BIDataService</a:To> 	</s:Header>	<s:Body>		<LogOn xmlns="https://rental5.ultipro.com/services">			<logOnRequest xmlns:i="http://www.w3.org/2001/XMLSchema-instance">				<UserName>OsmoseAPI</UserName> 				<Password>Osmose980BF</Password> 				<ClientAccessKey>LA1YT</ClientAccessKey> 				<UserAccessKey>AOC0SU0000K0</UserAccessKey> 			</logOnRequest>		</LogOn>	</s:Body></s:Envelope>';

            // return http.request({
            //     method: http.Method.POST,
            //     url: loginurl,
            //     body:loginbody,
            //     headers:loginheader
            // });

            var api = "https://webopstest.osmose.com/MgmtToolsApi/";
            var tokenUri = "api/Authorization/AuthorizationToken/";
            var applicationId = "15/";
            var userName = "serv_utiliis";

            var token = https.get({
                url: api + tokenUri + applicationId + userName
            }).body;

            return JSON.parse(https.get({
                url: "https://webopstest.osmose.com/MgmtToolsApi/api/ERP/GeneralLedgerData",
                headers: {"X-Authorization": "Bearer " + token}
            }).body);

            return https.post({
                // method: https.Method.POST,
                url: urls,
                body: body,
                headers: header
            });
            // return http.get({
            //     url: loginurl,
            //     body: loginbody,
            //     headers: loginheader
            // })
            // var s = '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">   <s:Header>   <a:Action s:mustUnderstand="1">http://www.ultipro.com/services/loginservice/ILoginService/Authenticate</a:Action>  <h:ClientAccessKey xmlns:h="http://www.ultipro.com/services/loginservice">CCWFP</h:ClientAccessKey>    \t    <h:Password xmlns:h="http://www.ultipro.com/services/loginservice">Osmose980BF</h:Password>    \t    <h:UserAccessKey xmlns:h="http://www.ultipro.com/services/loginservice">AOC0SU0000K0</h:UserAccessKey>    \t    <h:UserName xmlns:h="http://www.ultipro.com/services/loginservice">OsmoseAPI</h:UserName>    </s:Header>   <s:Body>     <TokenRequest xmlns="http://www.ultipro.com/contracts" />    </s:Body> </s:Envelope> '
        };

        function doPost(context)
        {	
			try{
				/********************************* Started Code Added By Yogesh On 7th Mar 2025 to send Job details ******************************************/

			    if (context.searchType == "job") {
					
					var jobColumns = context.columns;
					var jobFilters = context.filters;

					if (jobColumns && jobFilters) {
						
						log.debug("jobColumns " + JSON.stringify(jobColumns), "jobFilters: " + JSON.stringify(jobFilters));
						
						var scriptObj = runtime.getCurrentScript();
						var searchId = scriptObj.getParameter({ name: 'custscript_oum_job_srch' });
			
						var jobSearchObj = search.load({ id: searchId });

						// Ensure jobFilters is converted to proper NetSuite filters
						var filtersArray = [];
						
						if (Array.isArray(jobFilters) && jobFilters.length > 0) {
							jobFilters.forEach(function(filter) {
								filtersArray.push(search.createFilter({
									name: filter[0],       // Field Name (e.g., 'lastmodifieddate')
									operator: filter[1],   // Operator (e.g., 'within')
									values: filter.slice(2) // Values (e.g., ['01/04/2025 12:00 am', '02/28/2025 11:59 pm'])
								}));
							});
						} else {
							log.error("Invalid jobFilters format", jobFilters);
							return JSON.stringify({ error: "Invalid filter format" });
						}

						// Append filters correctly
						jobSearchObj.filters = jobSearchObj.filters.concat(filtersArray);

						var jobResults = [];
						var searchResultCount = jobSearchObj.runPaged().count;
						log.debug("Total Job Search Results:", searchResultCount);

						// Process results in batches of 1,000
						var pagedData = jobSearchObj.runPaged({ pageSize: 1000 });

						pagedData.pageRanges.forEach(function (pageRange) {
							var page = pagedData.fetch({ index: pageRange.index });
							page.data.forEach(function (result) {
								jobResults.push({
									internalId: result.getValue("internalid"),
									jobId: result.getValue("entityid")
								});
							});
						});

						return { jobs: jobResults };

					} else {
						return JSON.stringify({ error: "Start date is required for Job search" });
					}
				}				
				else				
				/********************************* Finished Code Added By Yogesh On 28th Feb 2025 to send Job details ******************************************/
				{
						/// ##### PAYROLL IMPORT TEST - REMOVE LATER #######################
					if (context.test == true)
					{
						return testFunctions(context);
					}
					/// ################ END PAYROLL IMPORT TEST #######################

					// log.debug("Search Data", context);
					if (context.test)
					{
						// var filters = ["internalid", "anyof", "37029", 10];
						// var columns = ["internalid", "entityid"];
						// var employee = new searchHelper.Search("employee", columns, filters);
						//
						//
						// return employee.firstOrDefault();
						// return testJournalEntry();
						// return testJobDataBus();
					}
					var mySearch;
					g_columns = context.columns;
					g_filters = context.filters;// context.filters ? context.filters : "";
					g_type = context.searchType;
					g_fieldsToGetText = context.fieldsToGetText;
					var includeJoinName = context.includeJoinName;
					var getFile = context.file ? context.file : false;
					var getFileContents = context.getFileContents ? context.getFileContents : false;
					var pdfOnly = context.pdfOnly ? context.pdfOnly : false;
					var templateScriptId = context.templateScriptId ? context.templateScriptId : false;
					var email = context.email ? context.email : false;
					var parameters = context.parameters ? context.parameters : [];

					if (typeof g_fieldsToGetText != "string" && g_fieldsToGetText != undefined)
					{
						g_fieldsToGetText = g_fieldsToGetText.join(",");
					}

					// log.debug("parameters", parameters);
					g_filters = searchHelper.updateFilters(g_filters, parameters);

					// return g_filters;

					// if (context.test)
					// {
					//     var transactionFile = render.transaction({
					//         entityId: 27686,
					//         printMode: render.PrintMode.PDF
					//     });
					//     return transactionFile.getContents();
					// }

					//Checks to see if it is a savedSearch. If so, return all columns.
					// var searchId = context.searchId ? JSON.parse(context.searchId) : null;
					var searchId = context.searchId ? context.searchId : null;

					if (context.test == true)
					{
						return testFunctions();
					}

					// return getFile;
					if (!searchId)
					{
						mySearch = createSearch().run();
						var results = sHelper.returnSearchObject(mySearch, g_fieldsToGetText, includeJoinName, getFile, getFileContents);
						if (email)
						{
							emHelper.sendEmail("Search", JSON.stringify(results));
						}


						if (context.returnType == "csv")
						{
							var json = sHelper.returnSavedSearchColumns(mySearch, g_fieldsToGetText, includeJoinName);
							// return ConvertToCSV(json);
							// return getCSV(json);
							// return convertToCSV(json);

							// return jsonToCSVPostman(json);
							return cmHelper.JSONToCSVConvertor(json, "", true);
							return JSONToCSVConvertor(json, "", true);
							return convertToCSV(json)
						}


						if (context.test)
						{
							var myTest = new searchHelper.Search(g_type, g_columns, g_filters, g_fieldsToGetText, includeJoinName);
							// return myTest
							// var bla = new searchHelper.Search(g_type, g_columns, g_filters, g_fieldsToGetText, includeJoinName).where("internalid", 2);
							var bla = new searchHelper.Search(g_type, g_columns, g_filters, g_fieldsToGetText, includeJoinName)
								.where("internalid", 14551).where('type', 'inv').toList();//.firstOrDefault();
							// return bla;
							bla = bla.where("type", 'inventory')
							return bla.toList();
							// var testlist = bla.toList();
							// return bla.where("internalid", 2);
							// return bla.toList();
							// return searchHelper.getResult(results, "internalid", 2);
						}
						return results;
					}
					else
					{
						var getFilters = context.getFilters ? JSON.parse(context.getFilters) : null;
						// return isNaN(searchId);
						if (isNaN(searchId))
						{
							searchId = sHandler[searchId];
						}
						if (getFilters)
						{
							return loadSearch(searchId).filters;
						}

						// var mySearch = search.load({
						//     id: 'customsearch_get_web_serv_log'
						// });

						// return JSON.stringify(searchId)
						var tmpSearch = loadSearch(searchId, g_filters, context);

						// mySearch = loadSearch(searchId);

						g_filters = tmpSearch.filterExpression;
						// tmpSearch.filters = tmpSearch.filterExpression;
						if (g_filters.length > 0 && context.filters)
						{
							g_filters.push("AND");
							// for (var i in context.filters)
							// {
							// var myFilt = context.filters[0];
							// tmpSearch.filters.push(search.createFilter({
							//     name: myFilt[0],
							//     operator: myFilt[1],
							//     values: myFilt[2]
							// }));


							// filters.push(search.createFilter({
							//     name: 'isinactive',
							//     operator: 'is',
							//     values: false
							// }));
							g_filters.push(context.filters);
							// }
						}
						else
						{
							g_filters = context.filters;
						}
						// tmpSearch.filters.push(search.createFilter({
						//     name: "internalid",
						//     operator: "anyof",
						//     values: [44090, 60288]
						// }));
						var bla = g_filters;

						tmpSearch.filters = []
						tmpSearch.filterExpression = bla;
						// tmpSearch.filterExpression = g_filters;
						// return tmpSearch.filterExpression;

						// return tmpSearch.filters
						// g_columns = tmpSearch.columns;
						// g_type = context.searchType;

						// return setupAdditionalFilters(g_filters);
						// return g_filters
						// g_columns = tmpSearch.columns;
						// var mySearch = createSearch();
						// return mySearch.filters;
						//Adds filters to the saved search.
						// mySearch = setupAdditionalFilters(mySearch);
						// return g_filters
						// return mySearch.filterExpression;


						// mySearch = createSearch();
						// mySearch = mySearch.run();

						// tmpSearch = getResults();

						tmpSearch = tmpSearch.run();
						if (context.returnType == "csv")
						{
							var json = sHelper.returnSavedSearchColumns(mySearch, g_fieldsToGetText, includeJoinName);
							// return ConvertToCSV(json);
							// return getCSV(json);
							// return convertToCSV(json);
							return JSONToCSVConvertor(json, "", true);
							return convertToCSV(json)
						}

						return sHelper.returnSavedSearchColumns(tmpSearch, g_fieldsToGetText, getFile, pdfOnly, templateScriptId);
					}
				}
                
            }
            catch (e)
            {
                var err = new eHelper.Error(e);
                return err
                return err.getStackTrace();
                return eHelper.getError(e);
            }
        }

        return {
            get: doGet,
            post: doPost
        };
    });