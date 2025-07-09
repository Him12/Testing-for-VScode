/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(["N/ui/serverWidget", "N/record", "N/log", "N/redirect"],

    (serverWidget, record, log, redirect) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        
        const onRequest = (scriptContext) => {
            log.debug("onRequest Method?", scriptContext.request.method);
            if (scriptContext.request.method == "GET") {
                // Create the form
                var form = serverWidget.createForm({
                    title: 'First Customize form'
                });

                var fieldgroup = form.addFieldGroup({
                    id: 'userdetails',
                    label: 'USER INFORMATION'
                });

                var fname = form.addField({
                    id: 'custpage_fname',
                    type: serverWidget.FieldType.TEXT,
                    label: 'First Name',
                    container: 'userdetails'
                }).isMandatory = true;

                var lname = form.addField({
                    id: 'custpage_lname',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Last Name',
                    container: 'userdetails'
                }).isMandatory = true;

                var mname = form.addField({
                    id: 'custpage_mname',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Middle Name',
                    container: 'userdetails'
                });

                var mobnum = form.addField({
                    id: 'custpage_mobnum',
                    type: serverWidget.FieldType.PHONE,
                    label: 'Mobile Number',
                    container: 'userdetails'
                });

                var email = form.addField({
                    id: 'custpage_email',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Email',
                    container: 'userdetails'
                }).isMandatory = true;

                form.addResetButton({
                    label: 'Reset Button'
                });

                form.addSubmitButton({
                    label: 'Submit Button'
                });

                // Add the new button labeled "Send Email"
                form.addButton({
                    id: 'custpage_send_email',
                    label: 'Send Email',
                    functionName: 'sendEmail'
                });

                const parentsDetailsGroup = form.addFieldGroup({
                    id: 'custpage_parentsdetails',
                    label: 'ABOUT YOUR FAMILY'
                });

                var fat_name = form.addField({
                    id: 'custpage_fat_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Father Name',
                    container: 'custpage_parentsdetails'
                });

                var mot_name = form.addField({
                    id: 'custpage_mot_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Mother Name',
                    container: 'custpage_parentsdetails'
                });

                var marriage_status = form.addField({
                    id: 'custpage_marriage_status',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Married',
                    container: 'custpage_parentsdetails'
                });

                // Adding options to the 'Married' field
                marriage_status.addSelectOption({ value: 'select', text: 'Select Option' });
                marriage_status.addSelectOption({ value: 'yes', text: 'Yes' });
                marriage_status.addSelectOption({ value: 'no', text: 'No' });

                var sublist = form.addSublist({
                    id: 'custpage_sublistid',
                    type: serverWidget.SublistType.LIST,
                    label: 'Sublist'
                });
                sublist.addMarkAllButtons();
                sublist.addField({
                    id: 'custpage_checkbox',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'SELECT'
                });
                sublist.addField({
                    id: 'custpage_customer',
                    type: serverWidget.FieldType.TEXT,
                    label: 'CUSTOMER'
                });
                sublist.addField({
                    id: 'custpage_internal_id',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Internal ID'
                });
                sublist.addField({
                    id: 'custpage_transaction_no',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'TRANSACTION NUMBER'
                });
                sublist.addField({
                    id: 'custpage_remarks',
                    type: serverWidget.FieldType.TEXT,
                    label: 'ANY REMARKS NUMBER'
                });

                sublist.setSublistValue({
                    id: 'custpage_customer',
                    line: 0,
                    value: "Himanshu"
                });

                sublist.setSublistValue({
                    id: 'custpage_customer',
                    line: 1,
                    value: "Himanshu Kumar"
                });

                sublist.setSublistValue({
                    id: 'custpage_customer',
                    line: 2,
                    value: "Himanshu Dubey"
                });

                sublist.setSublistValue({
                    id: 'custpage_customer',
                    line: 3,
                    value: "Himanshu Kumar Dubey"
                });

                sublist.setSublistValue({
                    id: 'custpage_internal_id',
                    line: 0,
                    value: "11111"
                });

                sublist.setSublistValue({
                    id: 'custpage_internal_id',
                    line: 1,
                    value: "22222"
                });

                sublist.setSublistValue({
                    id: 'custpage_internal_id',
                    line: 2,
                    value: "33333"
                });

                sublist.setSublistValue({
                    id: 'custpage_internal_id',
                    line: 3,
                    value: "44444"
                });

                sublist.setSublistValue({
                    id: 'custpage_transaction_no',
                    line: 0,
                    value: "11111"
                });

                sublist.setSublistValue({
                    id: 'custpage_transaction_no',
                    line: 1,
                    value: "22222"
                });

                sublist.setSublistValue({
                    id: 'custpage_transaction_no',
                    line: 2,
                    value: "33333"
                });

                sublist.setSublistValue({
                    id: 'custpage_transaction_no',
                    line: 3,
                    value: "44444"
                });

                sublist.setSublistValue({
                    id: 'custpage_remarks',
                    line: 0,
                    value: "Good Attempt"
                });

                sublist.setSublistValue({
                    id: 'custpage_remarks',
                    line: 1,
                    value: "Very Good Attempt"
                });

                sublist.setSublistValue({
                    id: 'custpage_remarks',
                    line: 2,
                    value: "Very Intelligent Attempt"
                });

                sublist.setSublistValue({
                    id: 'custpage_remarks',
                    line: 3,
                    value: "Great Attempt"
                });

                // Add the client script to the form
                form.clientScriptModulePath = './clientscriptvalidation.js';

                scriptContext.response.writePage({
                    pageObject: form
                });

            } else { // POST request handling (saving data to the custom record)
                log.debug("Request Method in else", scriptContext.request.method);
                
                // Retrieve form data
                var firstName = scriptContext.request.parameters.custpage_fname;
                var lastName = scriptContext.request.parameters.custpage_lname;
                var middleName = scriptContext.request.parameters.custpage_mname;
                var mobileNumber = scriptContext.request.parameters.custpage_mobnum;
                var email = scriptContext.request.parameters.custpage_email;
                var fatherName = scriptContext.request.parameters.custpage_fat_name;
                var motherName = scriptContext.request.parameters.custpage_mot_name;
                var marriageStatus = scriptContext.request.parameters.custpage_marriage_status;

                log.debug("First Name", firstName);
                log.debug("Last Name", lastName);
                log.debug("Middle Name", middleName);
                log.debug("Mobile Number", mobileNumber);
                log.debug("Email", email);
                log.debug("Father Name", fatherName);
                log.debug("Mother Name", motherName);
                log.debug("Marriage Status", marriageStatus);

                // Validate mobile number
                if (mobileNumber.length !== 10) {
                    throw new Error('Mobile number must be exactly 10 digits.');
                }

                // Create a new custom record and set the field values
                var customRecord = record.create({
                    type: 'customrecord_ng_suitelet_data_entry', // Use your custom record type ID
                    isDynamic: true
                });

                customRecord.setValue({
                    fieldId: 'custrecord_ng_first_name',
                    value: firstName
                });
                customRecord.setValue({
                    fieldId: 'custrecord_ng_last_name',
                    value: lastName
                });
                customRecord.setValue({
                    fieldId: 'custrecord_ng_emailaddress',
                    value: email
                });
                customRecord.setValue({
                    fieldId: 'custrecord155',
                    value: mobileNumber
                });
                customRecord.setValue({
                    fieldId: 'custrecord156',
                    value: fatherName
                });
                customRecord.setValue({
                    fieldId: 'custrecord_ng_mothername',
                    value: motherName
                });

                var recordId = customRecord.save();

                log.debug("Custom Record Created with ID", recordId);

                // Redirect to the newly created custom record
                redirect.toRecord({
                    type: 'customrecord_ng_suitelet_data_entry', // Custom record type
                    id: recordId
                });
            }
        };

        return {
            onRequest: onRequest
        };
    });
