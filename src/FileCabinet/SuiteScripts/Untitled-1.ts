/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/redirect', 'N/url', 'N/format', 'N/task', 'N/query'],
    function(serverWidget, search, record, redirect, url, format, task, query) {

        function onRequest(context) {
            try {
                if (context.request.method === 'GET') {
                    renderForm(context);
                } else {
                    handlePostRequest(context);
                }
            } catch (e) {
                logError(e);
                context.response.write(`<h2>Error</h2><p>${e.name} => ${e.message}</p>`);
            }
        }

        function renderForm(context) {
            var form = serverWidget.createForm({
                title: 'Late Fee Application'
            });

            // Add Fields
            addFilterFields(form, context);
            addLateFeeInfoFields(form, context);
            addInvoiceSublist(form);



            // Add Buttons and Client Script
            addButtons(form);
            form.clientScriptModulePath = 'SuiteScripts/_osm_lateFeeApplication_CS.js';

            // Fetch and populate invoice data
            populateInvoiceSublist(form, context);

            context.response.writePage(form);
        }

        function addFilterFields(form, context) {
            var sixMonthsAgo = getDateSixMonthsAgo();
            form.addFieldGroup({
                id: 'custpage_filters',
                label: 'Late Fee Filters'
            });

            // Subsidiary Field
            var formsubs = form.addField({
                id: 'custpage_subsidiary',
                type: serverWidget.FieldType.SELECT,
                label: 'NetSuite Subsidiary',
                container: 'custpage_filters'
            });
            formsubs.addSelectOption({
                value: '',
                text: 'Select a Subsidiary'
            });
            populateSelectOptions('subsidiary', 'namenohierarchy', formsubs);
           // log.debug('context.request.parameters.custpage_subsidiary', context.request.parameters.custpage_subsidiary);
            formsubs.defaultValue = context.request.parameters.custpage_subsidiary;
			

            // Job ID Field
            var job_field = form.addField({
                id: 'custpage_job_id',
                type: serverWidget.FieldType.SELECT,
                label: 'Job ID',
                //source:'job',
                container: 'custpage_filters'
            });
         //   log.debug('jobid', context.request.parameters.custpage_job_id);
            

            // Invoice From
           var invFrom =  form.addField({
                id: 'custpage_invoicefrom',
                type: serverWidget.FieldType.DATE,
                label: 'Invoice From',
                container: 'custpage_filters'
           });
            // }).defaultValue = format.format({
            //     value: sixMonthsAgo,
            //     type: format.Type.DATE
            // });

          if (context.request.parameters.fromDate){
            invFrom.defaultValue = format.format({
                value:new Date( context.request.parameters.fromDate),
                type: format.Type.DATE
            });
          }
          else{
            invFrom.defaultValue = format.format({
                value:sixMonthsAgo,
                type: format.Type.DATE
            });
          }
            form.addField({
                id: 'custpage_highlighted_note',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Highlighted Note',
                container: 'custpage_filters'
            }).defaultValue = `
                <div id="custom-status" style="
                   background-color: #ebedef;
                   padding: 10px;
                   font-weight: bold;
                   text-align: center;
                   color: #cb4335;
                   font-size: 12px;
                   position: absolute;
                   top: 88px; /* Position from the top */
                   right: 280px; /* position from left */
                   z-index: 1000;
                   box-sizing: border-box;
               ">
<strong>NOTE: Please click on Reset Button to refresh the filters.</strong>
</div>
            `;

            // Customer Field
            var cust_field = form.addField({
                id: 'custpage_customer',
                type: serverWidget.FieldType.SELECT,
                label: 'Customer',
               // source:'customer',
                container: 'custpage_filters'
            });
           // cust_field.defaultValue = context.request.parameters.custpage_customer;

            // Service Code Field
            var sc_field = form.addField({
                id: 'custpage_service_code',
                type: serverWidget.FieldType.SELECT,
                label: 'Service Code',
                container: 'custpage_filters'
            });
            sc_field.defaultValue = context.request.parameters.custpage_service_code;

            // Invoice To
            var invTo = form.addField({
                id: 'custpage_invoiceto',
                type: serverWidget.FieldType.DATE,
                label: 'Invoice To',
                container: 'custpage_filters'
            });
            // }).defaultValue = format.format({
            //     value: new Date(),
            //     type: format.Type.DATE
            // });

          if (context.request.parameters.toDate){
            invTo.defaultValue = format.format({
                value:new Date( context.request.parameters.toDate),
                type: format.Type.DATE
            });
          }
          else{
            invTo.defaultValue = format.format({
                value:new Date(),
                type: format.Type.DATE
            });
          }
		  
		  
		  if (context.request.parameters.custpage_subsidiary){
			 
        
            updateFieldOptionsForJob_cust(cust_field, search.Type.CUSTOMER, 'internalid', 'entityid', 'altname', [
                ['subsidiary', search.Operator.ANYOF, context.request.parameters.custpage_subsidiary]
            ]);
            updateFieldOptionsForJob_cust(job_field, search.Type.JOB, 'internalid', 'entityid', 'companyname', [
                ['subsidiary', search.Operator.ANYOF, context.request.parameters.custpage_subsidiary]
            ]);
            updateFieldOptions(sc_field, search.Type.CLASSIFICATION, 'internalid', 'namenohierarchy', [
                ['subsidiary', search.Operator.ANYOF, context.request.parameters.custpage_subsidiary]
            ]);
          
      
   
		  }
//log.debug('context.request.parameters.custpage_customer',context.request.parameters.custpage_customer);
          job_field.defaultValue = context.request.parameters.custpage_job_id;
          cust_field.defaultValue = context.request.parameters.custpage_customer;
          sc_field.defaultValue = context.request.parameters.custpage_service_code;
          
        /* else {
            clearFieldOptions('custpage_customer');
            clearFieldOptions('custpage_job_id');
            clearFieldOptions('custpage_service_code');
        }*/
		  
		  

        }

        function addLateFeeInfoFields(form, context) {
            form.addFieldGroup({
                id: 'custpage_latefee_info',
                label: 'Late Fee Information'
            });

            var lateFeeInvDate = form.addField({
                    id: 'custpage_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'Late Fee Invoice Date',
                    container: 'custpage_latefee_info'
                });
                // .defaultValue = format.format({
                //     value: new Date(),
                //     type: format.Type.DATE
                // });
          if (context.request.parameters.lfdate){
            lateFeeInvDate.defaultValue = format.format({
                value:new Date( context.request.parameters.lfdate),
                type: format.Type.DATE
            });
          }
          else{
            lateFeeInvDate.defaultValue = format.format({
                value:new Date(),
                type: format.Type.DATE
            });
          }
        }

        function addInvoiceSublist(form) {

            var sublist = form.addSublist({
                id: 'custpage_invoice_sublist',
                type: serverWidget.SublistType.LIST,
                label: 'Invoices',
                tab: 'custpage_subtabinvoicelist'
            });         

            sublist.addField({
                id: 'custpage_select',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Select'
            });
            sublist.addField({
                id: 'custpage_invoice_number',
                type: serverWidget.FieldType.TEXT,
                label: 'Invoice No.'
            });
            sublist.addField({
                id: 'custpage_invoice_id',
                type: serverWidget.FieldType.TEXT,
                label: 'Invoice Id'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            sublist.addField({
                id: 'custpage_customer_name',
                type: serverWidget.FieldType.TEXT,
                label: 'Customer Name'
            });
            sublist.addField({
                id: 'custpage_customer_id',
                type: serverWidget.FieldType.TEXT,
                label: 'Customer Id'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
           
            sublist.addField({
                id: 'custpage_invoice_date',
                type: serverWidget.FieldType.DATE,
                label: 'Invoice Date'
            });
            sublist.addField({
                id: 'custpage_due_date',
                type: serverWidget.FieldType.DATE,
                label: 'Due Date'
            });

            sublist.addField({
                id: 'custpage_overdue_days',
                type: serverWidget.FieldType.TEXT,
                label: 'Overdue Days'
            });
           sublist.addField({
                id: 'custpage_currecy',
                type: serverWidget.FieldType.TEXT,
                label: 'CUR'
            });
            sublist.addField({
                id: 'custpage_remaining_amount',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Remaining Amount'
            });
            sublist.addField({
                id: 'custpage_remaining_amount_',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Remaining Amount'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            sublist.addField({
                id: 'custpage_amount',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Original Amount'
            });
            sublist.addField({
                id: 'custpage_latefee_percent',
                type: serverWidget.FieldType.PERCENT,
                label: 'Late Fee Percentage'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
            });
            sublist.addField({
                id: 'custpage_latefee_amount',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Late Fee Amount'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
            });

        }

        function addButtons(form) {
            form.addSubmitButton({
                label: 'Generate Invoice'
            });
            form.addButton({
                id: 'custpage_reset',
                label: 'Reset',
                functionName: 'reset()'
            });
            form.addButton({
                id: 'custpage_search',
                label: 'Search',
                functionName: 'filterData()'
            });
        }

        function populateSelectOptions(type, columnName, field) {
            var searchObj = search.create({
                type: type,
                columns: [columnName]
            });
            searchObj.run().each(function(result) {
                field.addSelectOption({
                    value: result.id,
                    text: result.getValue(columnName)
                });
                return true;
            });
        }

        function populateInvoiceSublist(form, context) {
            var sublist = form.getSublist({
                id: 'custpage_invoice_sublist'
            });

            var subs = context.request.parameters.custpage_subsidiary;
            var servicecode = context.request.parameters.custpage_service_code;
            var jobid = context.request.parameters.custpage_job_id;
            var customer = context.request.parameters.custpage_customer;

           // log.debug('subs', subs);
           // log.debug('jobid', jobid);

            if (subs || jobid || servicecode || customer) {

                var results = fetchSuiteQLData(context);
              //  log.debug('results', results);
                var resultIndex = 0;

                results.forEach(function(result) {
                    var recordUrl = url.resolveRecord({
                        recordType: record.Type.INVOICE,
                        recordId: result.id,
                        isEditMode: false
                    });

                    sublist.setSublistValue({
                        id: 'custpage_invoice_number',
                        line: resultIndex,
                        value: `<a href="${recordUrl}" target="_blank">${result.tranid}</a>`
                    });
                    sublist.setSublistValue({
                        id: 'custpage_customer_name',
                        line: resultIndex,
                        value: result.customer
                    });
                    sublist.setSublistValue({
                        id: 'custpage_customer_id',
                        line: resultIndex,
                        value: result.customerid
                    });
                    sublist.setSublistValue({
                        id: 'custpage_invoice_date',
                        line: resultIndex,
                        value: result.trandate
                    });
                    sublist.setSublistValue({
                        id: 'custpage_currecy',
                        line: resultIndex,
                        value: result.currency
                    });
                    sublist.setSublistValue({
                        id: 'custpage_amount',
                        line: resultIndex,
                        value: result.amount
                    });
                    sublist.setSublistValue({
                        id: 'custpage_invoice_id',
                        line: resultIndex,
                        value: result.id
                    });
                    sublist.setSublistValue({
                        id: 'custpage_remaining_amount',
                        line: resultIndex,
                        value: result.amountremaining
                    });
                    sublist.setSublistValue({
                        id: 'custpage_overdue_days',
                        line: resultIndex,
                        value: result.daysoverduesearch
                    });
                    sublist.setSublistValue({
                        id: 'custpage_due_date',
                        line: resultIndex,
                        value: result.duedate
                    });
                    sublist.setSublistValue({
                        id: 'custpage_remaining_amount_',
                        line: resultIndex,
                        value: result.amount
                    });

                    resultIndex++;
                });
            }
        }



        function fetchSuiteQLData(context) {

            var fromDate = formatDateToYYYYMMDD(context.request.parameters.fromDate);
            var toDate = formatDateToYYYYMMDD(context.request.parameters.toDate);

          //  log.debug('fromDate', fromDate);
          //  log.debug('toDate', toDate);
            var suiteQLQuery = `
                SELECT 
                    transaction.tranid, 
                    transaction.id, 
                    transaction.trandate,
					transaction.dueDate,
                    transaction.entity as customerid, 
                    builtin.DF(transaction.entity) as customer, 
                    currency.symbol as currency,  
                    transaction.daysoverduesearch, 
                    transaction.foreignamountunpaid as amountremaining,
                    transaction.foreigntotal as amount,
                    FROM transactionline
                    INNER JOIN transaction 
                    ON transactionline .transaction = transaction.id
                    INNER JOIN currency 
                   ON currency.id = transaction.currency
                 
                WHERE 
                    transaction.recordType='invoice' AND
                    transactionline.mainline = 'T' AND
                    transactionline.taxline= 'F' AND
                    transaction.status = 'CustInvc:A' AND
                    NVL(transaction.custbody_osm_late_fee_invoice,'F') ='F' AND
                    NVL(transaction.custbody_osm_late_fee_applied,'F') ='F' `;


            if (context.request.parameters.custpage_subsidiary) {
                suiteQLQuery += ` AND subsidiary = ${context.request.parameters.custpage_subsidiary}`;
            }

            if (context.request.parameters.custpage_job_id) {
                suiteQLQuery += ` AND custbody_job = ${context.request.parameters.custpage_job_id}`;
            }

            if (context.request.parameters.custpage_service_code) {
                suiteQLQuery += ` AND class = ${context.request.parameters.custpage_service_code}`;
            }

            if (context.request.parameters.custpage_customer) {
                suiteQLQuery += ` AND transaction.entity = ${context.request.parameters.custpage_customer}`;
            }

            if (fromDate && toDate) {
                suiteQLQuery += ` AND transaction.trandate BETWEEN TO_DATE('${fromDate}', 'yyyy/mm/dd') AND TO_DATE('${toDate}', 'yyyy/mm/dd')`;
            }
          //  log.debug("suiteQLQuery", suiteQLQuery);
            return query.runSuiteQL({
                query: suiteQLQuery
            }).asMappedResults();
        }

        function handlePostRequest(context) {

            try {
                var trandate = context.request.parameters.custpage_date;
                var scriptData = getScriptID();
                // Collect selected invoices
                var selectedInvoices = [];
                var lineCount = context.request.getLineCount({
                    group: 'custpage_invoice_sublist'
                });

                for (var i = 0; i < lineCount; i++) {
                    var isSelected = context.request.getSublistValue({
                        group: 'custpage_invoice_sublist',
                        name: 'custpage_select',
                        line: i
                    });

                    if (isSelected === 'T') {
                        selectedInvoices.push({
                            id: context.request.getSublistValue({
                                group: 'custpage_invoice_sublist',
                                name: 'custpage_invoice_id',
                                line: i
                            }),
                            customer: context.request.getSublistValue({
                                group: 'custpage_invoice_sublist',
                                name: 'custpage_customer_id',
                                line: i
                            }),
                            lateFeeAmount: context.request.getSublistValue({
                                group: 'custpage_invoice_sublist',
                                name: 'custpage_latefee_amount',
                                line: i
                            })
                        });
                    }
                }
              //  log.debug('JSON.stringify(selectedInvoices)', JSON.stringify(selectedInvoices));
                // Submit the Map/Reduce task


                var mapReduceTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE
                });
                mapReduceTask.scriptId = 'customscript_osm_late_fee_application_mr';
                mapReduceTask.deploymentId = 'customdeploy_osm_late_fee_application_mr';
                mapReduceTask.params = {
                    custscript_selected_invoices: JSON.stringify(selectedInvoices),
                    custscript_trandate: trandate
                };
                //objTask.submit();
                log.debug('mapReduceTask', mapReduceTask);
                var taskId = mapReduceTask.submit();
                log.debug('Map/Reduce Task Submitted', 'Task ID: ' + taskId);
                var taskStatus = task.checkStatus(taskId);
                log.debug('taskStatus', taskStatus);

                /*redirect.toTaskLink({
                    taskId: taskId
                });*/

                if (task.checkStatus(taskId) == 'FAILED') {

                    var response = getSummaryHTML();
                    response = response.replace('STATUS', 'Failed');
                    response = response.replace('SCRIPTDEPLOYMENTLINK', 'Please check the script logs and resubmit');
                    context.response.write(response);

                } else {

                    var response = getSummaryHTML();
                    response = response.replace('STATUS', 'Successfull');
                    response = response.replace('SCRIPTDEPLOYMENTLINK', '/app/common/scripting/mapreducescriptstatus.nl?sortcol=dcreated&sortdir=DESC&date=TODAY&scripttype=' + scriptData.script + '&primarykey=' + scriptData.primarykey);
                    context.response.write(response);

                }
            } catch (e) {
                context.response.write(
                    '<br/><h2>Error</h2><p>' + e.name + '=>' + e.message + '</p>'
                );
                log.debug('Error in Post function', e.name + "=>" + e.message + "\n" + e.stack);
            }
        }

        function logError(e) {
            log.error({
                title: e.name,
                details: e.message
            });
        }

        function getScriptID() {

            const SQL = "SELECT primaryKey,script FROM scriptDeployment WHERE isdeployed = 'T' AND scriptid = 'customdeploy_osm_late_fee_application_mr'";

            queryIterator = query.runSuiteQLPaged({
                query: SQL,
                pageSize: 1
            }).iterator();

            var scriptData = {}

            queryIterator.each(function(page) {
                var pageIterator = page.value.data.iterator();
                log.debug({
                    title: 'pageIterator',
                    details: pageIterator
                });
                pageIterator.each(function(row) {
                    scriptData = row.value.asMap();
                });
            });

            return scriptData;

        }

        function getSummaryHTML() {

            var html =
                '<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                '<style>' +
                'table {' +
                'font-family: arial, sans-serif;' +
                'border-collapse: collapse;' +
                'width: 100%;' +
                '}' +
                'td, th {' +
                'border: 1px solid #dddddd;' +
                'text-align: left;' +
                'padding: 8px;' +
                '}' +
                'tr:nth-child(even) {' +
                'background-color: #ffffff;' +
                '}' +
                '</style>' +
                '</head>' +
                '<body>' +
                ' <center><h2>Late Fee Application Invoice Status</h2></center>' +
                '<table>' +
                '<tr>' +
                '<th colspan="2"><center>Summary</center></th>' +
                '</tr>' +
                '<tr>' +
                '<td>Status</td>' +
                '<td>STATUS</td>' +
                '</tr>' +
                '<tr>' +
                '<td>View Job Status</td>' +
                '<td><a href="SCRIPTDEPLOYMENTLINK" target="_blank" >Click Here</a></td>' +
                '</tr>' +
                '</table>' +
                '</body>' +
                '</html>';

            return html;
        }

        function getDateSixMonthsAgo() {
            var today = new Date();
            var sixMonthsAgo = new Date(today);
            sixMonthsAgo.setMonth(today.getMonth() - 3);

            return sixMonthsAgo;
        }

        function formatDateToYYYYMMDD(_Date) {
            log.debug('Date', _Date);
            var date = new Date(_Date);
            var year = date.getFullYear();
            var month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-based, so add 1
            var day = date.getDate().toString().padStart(2, '0'); // Ensure two-digit day

            return `${year}-${month}-${day}`;
        }
		
		
		function updateFieldOptionsForJob_cust(fieldId, searchType, valueColumn, textColumn, textColumn1, filters) {
        
        const field = fieldId;

        const searchObj = search.create({
            type: searchType,
            filters,
            columns: [valueColumn, textColumn, textColumn1]
        });
        var searchResultCount = searchObj.runPaged().count;
        //alert("jobSearchObj result count=>"+searchResultCount);


        updateSelectOptions(field, searchObj, valueColumn, textColumn, textColumn1);
    }

    function updateSelectOptions(field, searchObj, valueColumn, textColumn, textColumn1) {
        // field.removeSelectOption({
        //     value: null
        // });
        field.addSelectOption({
            value: '',
            text: ''
        });

        const pageSize = 1000;
        let pageIndex = 0;

        function processResults() {
            var results = searchObj.run().getRange({
                start: pageIndex * pageSize,
                end: (pageIndex + 1) * pageSize
            });


            results.forEach(result => {
                let text = result.getValue(textColumn);
                if (textColumn1) {
                    text += ' ' + result.getValue(textColumn1);
                }
                field.addSelectOption({
                    value: result.getValue(valueColumn),
                    text
                });
            });
        log.debug('results.length====>',results.length);
            if (results.length === pageSize) {
                pageIndex++;
               // setTimeout(processResults, 0); // Process next chunk
            }
        }

        processResults();
    }
	
	function updateFieldOptions(fieldId, searchType, valueColumn, textColumn, filters) {
       
        const field = fieldId;
         

        const searchObj = search.create({
            type: searchType,
            filters,
            columns: [valueColumn, textColumn]
        });

        updateSelectOptions(field, searchObj, valueColumn, textColumn);
    }


        return {
            onRequest: onRequest
        };
    }
);