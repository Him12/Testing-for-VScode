/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 * @NModuleScope public
 *@NAmdConfig  /SuiteScripts/Source/Libs/helperConfig.json
 */

define(['N/record', "N/search", "N/format", "./ous_job_helper", "moment", "dmHelper", "sublistHelper", "errorHelper", "searchHelper", "formSelector", "emailHelper", "cHelper", "lodash"],
    function (record, search, format, jobHelper, moment, dmHelper, suHelper, eHelper, sHelper, fh, emailHelper, cHelper, lodash) {
        // var subsidiariesJSON = [];
        var territoriesJSON = [];
        var serviceCodeJSON = [];
        var entityStatusJSON = [];
        var customerJSON = [];
        var employeeJSON = [];
        var itemsJSON = [];
        var opportunityJSON = [];
        var jobJSON = [];
        var additionalCostJSON = [];
        var estimateJSON = [];
        var specialItemsJSON = [];
        var termsJSON = [];
        var projIdsJSON = [];
        var projJobsJSON = [];
        var statesJSON = [];

        var g_jobId = null;
        var g_jobNo = null;
        var g_rollbackAdditCost = [];
        var g_rollbackEstimates = [];
        var g_rollbackOpportunities = [];

        var g_projEst = "Project Estimator";
        var g_contrAdmin = "Contract Administrator";
        var g_dbd = "Director Business Development";
        var g_genMan = "General Manager Operations";
        var g_manOpProjLead = "Manager Operations/Project Lead";
        var g_lookupVals = null;
        var liItemsDontExists = null; // used in addJobEstimates to see if the product exists. If not, it errors and deletes the job.
        var liJobResourceNotValid = null;
        var governance = 0;
        var g_bExists = false;

        // var resourceRoles = "";

        /**
         * Add's to the global governance variable
         * @param number Amount to increase governance
         */
        function addGov(number) {
            governance += number;
        }

        //Get's the territory id based on the territory text
        function getTerritoryFromJson(ter) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var territory = "";
                territoriesJSON.some(function (elem) {
                    territory = dmHelper.formatValue(elem.name) == ter ? elem : null;
                    return dmHelper.formatValue(elem.name) == ter;
                });
                return territory;
            } catch (e) {
                log.error('Error in getTerritoryFromJson function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        //Get's the service code id based on the service code text
        function getServCodeFromJson(servCode) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var returnObj = "";
                servCode = dmHelper.getActualName(servCode);

                serviceCodeJSON.some(function (elem) {
                    returnObj = dmHelper.formatValue(dmHelper.getActualName(elem.name)) == servCode ? elem : null;
                    return dmHelper.formatValue(dmHelper.getActualName(elem.name)) == servCode;
                });
                return returnObj;
            } catch (e) {
                log.error('Error in getServCodeFromJson function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        //Get's the entity status id based on the entity status text
        function getEntityStatusFromJson(entityStatus, entStatus) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                entityStatusJSON.some(function (elem) {
                    entityStatus = dmHelper.formatValue(elem.name) == entStatus ? elem : null;
                    return dmHelper.formatValue(elem.name) == entStatus;
                });
                return entityStatus;
            } catch (e) {
                log.error('Error in getEntityStatusFromJson function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        //Get's the customer and subsidiary IDs based on the customer
        function getCustomerAndSubFromJson(customerId) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var customer = null;
                var subsidiary = null;
                var paymentTerms = null;
                customerJSON.some(function (elem) {
                    customer = elem.CustomerID == customerId ? elem : null;
                    subsidiary = elem.subsidiary; // dmHelper.formatValue(elem.subsidiaryName) === sub ? elem : null;
                    paymentTerms = elem.paymentTerms
                    return elem.CustomerID == customerId;
                });
                return {
                    customer: customer,
                    subsidiary: subsidiary,
                    paymentTerms: paymentTerms
                };
            } catch (e) {
                log.error('Error in getCustomerAndSubFromJson function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        //Get's the item id based on the product number
        function getItemFromJson(item) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var returnObj = "";
                itemsJSON.some(function (elem) {
                    returnObj = dmHelper.formatValue(elem.itemNo) == item ? elem : null;
                    return dmHelper.formatValue(elem.itemNo) == item;
                });
                return returnObj;
            } catch (e) {
                log.error('Error in getItemFromJson function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        //Get's the job id based on the product number
        function getJobFromJson(job) {

            var returnObj = "";
            jobJSON.some(function (elem) {
                returnObj = elem.jobId == job ? elem : null;
                return elem.jobId == job;
            });
            return returnObj;
        }

        //Get's the item id based on the product number
        function getEstimateFromJson(job) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var returnObj = "";

                estimateJSON.some(function (elem) {
                    // var condition = (elem.jobId == job && elem.customer == g_lookupVals.customer.id);
                    // var condition = (elem.createdBy == job);
                    var condition = (elem.jobId == job);
                    returnObj = condition ? elem : null;
                    return condition;
                });

                return returnObj;
            } catch (e) {
                log.error('Error in getEstimateFromJson function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }


        /**
         * Gets the current state based on short name
         * @param value State/Province short name
         * @returns {state:string}
         */
        function getStateFromJson(value) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var workState = null;
                statesJSON.some(function (elem) {
                    workState = elem.shortName == value ? elem : null;
                    return elem.shortName == value;
                });
                return workState;
            } catch (e) {
                log.error('Error in getStateFromJson function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        /**
         * Get's the correct Internal ID's of the values passed in.
         * @param jobMT
         * @returns {{subsidiary: string, territory: string, serviceCode: string, entityStatus: string, customer: object, workState:string}}
         */
        function getLookupValues(jobMT) {

            var subsidiary = "",
                territory = "",
                serviceCode = "",
                entityStatus = "",
                customer = "";

            //Format the values to upper case and trimmed.
            // var sub = dmHelper.formatValue(jobMT["Subsidiary"]);
            var ter = dmHelper.formatValue(jobMT["Territory"]);
            var servCode = dmHelper.formatValue(jobMT["Service Code"]);
            var entStatus = dmHelper.formatValue(jobMT["Status"]);
            var customerId = dmHelper.formatValue(jobMT["Customer"]);
            var state = dmHelper.formatValue(jobMT["WorkState"]);

            //Filter's and get's the correct db record.
            // subsidiary = getSubsidiaryFromJson(subsidiary, sub);

            territory = getTerritoryFromJson(ter);
            var location = territory.location
            serviceCode = getServCodeFromJson(servCode);
            entityStatus = getEntityStatusFromJson(entityStatus, entStatus);
            var custJsonObj = getCustomerAndSubFromJson(customerId);
            var workState = getStateFromJson(state);

            return {
                subsidiary: custJsonObj.subsidiary,
                territory: territory,
                serviceCode: serviceCode,
                entityStatus: entityStatus,
                customer: custJsonObj.customer,
                location: location,
                workState: workState,
                paymentTerms: custJsonObj.paymentTerms
            };

        }


        /**
         * Get's the employee information for employee passed in.
         * @param employeeNo
         * @returns {*}
         */
        function getEmployee(employeeNo) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                if (employeeNo) {
                    var employee = null;

                    employeeJSON.some(function (elem) {
                        employee = elem.employeeNo == employeeNo ? elem : null;
                        return elem.employeeNo == employeeNo;
                    });
                    return employee;
                }

                return {
                    id: null,
                    name: null,
                    employeeNo: null
                };
            } catch (e) {
                log.error('Error in getEmployee function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        //Get's the opportunity id from the opportunity number/text
        function getOpportunityId(opportunity) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {

                if (opportunity) {
                    var objOpportunity = null;

                    opportunityJSON.some(function (elem) {
                        objOpportunity = elem.opportunityId == opportunity ? elem : null;
                        return elem.opportunityId == opportunity;
                    });
                    if (objOpportunity) {
                        return objOpportunity.id;
                    }
                }

                return null;
            } catch (e) {
                log.error('Error in getOpportunityId function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        /**
         * Create's the Additional Job Costs records associated to the job.
         * @param additCost
         * @param jobId
         */
        function addAdditionalCosts(additCost, jobId) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var newAdditionalCost = newAdditionalCost = record.create({
                    type: "customrecord_osm_addl_job_cost_details",
                    isDynamic: true
                });
                addGov(2);
                newAdditionalCost.setValue("custrecord_osm_job", jobId);
                newAdditionalCost.setValue("custrecord_osm_addl_cost_description", additCost["Description"]);
                newAdditionalCost.setValue("custrecord_osm_addl_cost_amount", additCost["Cost"]);
                newAdditionalCost.setValue("custrecord_osm_addl_cost_frequency", additCost["Cost Frequency Description"]);
                newAdditionalCost.setValue("custrecord_osm_addl_cost_notes", additCost["Notes"]);
                newAdditionalCost.setValue("custrecord_osm_addl_last_mod_by", null);
                // newAdditionalCost.setValue("custrecord_osm_addl_last_mod_by", getEmployee(additCost["Last Edited By"]).id);
                var lastEditDate = moment(additCost["Last Edited Date"]).toDate();
                newAdditionalCost.setValue("custrecord_osm_addl_last_modified_date", lastEditDate);
                var additCostId = newAdditionalCost.save();
                addGov(4);
                g_rollbackAdditCost.push(additCostId)
            } catch (e) {
                log.error('Error in addAdditionalCosts function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        // function updateOpportunityJob(opId, bDelete)
        // {
        //     var oppo = record.load({
        //         type: record.Type.OPPORTUNITY,
        //         id: opId,
        //         isDynamic: true
        //     });
        //     addGov(10);
        //
        //     if (!oppo.getValue("job") || bDelete)
        //     {
        //         var job = g_jobId;
        //         if (bDelete)
        //         {
        //             job = "";
        //         }
        //         oppo.setValue("job", job);
        //         addGov(20);
        //         // oppo.save();
        //
        //         record.submitFields({
        //             type: record.Type.OPPORTUNITY,
        //             id: oppo.id,
        //             values: {job: oppo.getValue("job")}
        //         });
        //
        //         if (!bDelete)
        //         {
        //             g_rollbackOpportunities.push(oppo.id);
        //         }
        //     }
        // }

        /**
         * Updates the Opportunity with the newly created (or updated) job id.
         * @param opId
         * @param jobId
         * @param bDelete
         */
        function updateOpportunityJob(opId, jobId, bDelete) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var oppo = record.load({
                    type: record.Type.OPPORTUNITY,
                    id: opId,
                    isDynamic: true
                });
                addGov(10);

                //if the opportunity doesn't have a job, update it and we are not rolling back due to an error.
                if (!oppo.getValue("job") || bDelete) {
                    if (bDelete) {
                        jobId = "";
                    }
                    oppo.setValue("job", jobId);
                    addGov(20);
                    oppo.save();

                    if (!bDelete) {
                        g_rollbackOpportunities.push(oppo.id);
                    }
                }
            } catch (e) {
                log.error('Error in updateOpportunityJob function', e.name + '=>' + e.message + '=>' + e.stack);
                throw {
                    name: "INVALID_JOB_OPPORTUNITY",
                    message: "Opportunity " + oppo.getValue("tranid") + " cannot be assigned " + g_jobNo +
                        ". Please make sure that the customer matches on both Opportunity and Job."
                };

            }
        }

        //#region - Add Special Items -
        /**
         * Add special (subtotal/retention/discount) item to the estimate.
         * @param jobEstimate
         * @param rate
         * @param useRetention
         * @returns {*}
         */
        // function createEstimateSpeiclaItemLine(jobEstimate, rate, useRetention)
        // {
        //     var sublistId = "item";
        //
        //     var item = {};
        //
        //     //Get the discount/retention item to be added to the estimate.
        //     specialItemsJSON.some(function (elem) {
        //         var condition = dmHelper.formatValue(elem.rate) == rate && elem["retentionItem"] == useRetention;
        //         item = condition ? elem : null;
        //         return condition;
        //     });
        //
        //     addGov(5);
        //     jobEstimate.selectNewLine({
        //         sublistId: sublistId
        //     });
        //
        //     suHelper.setCurrentSublistValue(jobEstimate, sublistId, "item", item["itemId"]);
        //     suHelper.setCurrentSublistValue(jobEstimate, sublistId, "quantity", 1);
        //     jobEstimate.commitLine({sublistId: sublistId});
        //     return jobEstimate;
        // }

        /**
         * Adds a subtotal to the bottom of an estimate so that it can be discounted or apply retention.
         * @param jobEstimate
         * @returns {*}
         */
        // function createEstimateSubTotalItem(jobEstimate)
        // {
        //     var sublistId = "item";
        //
        //     var item = "";
        //     specialItemsJSON.some(function (elem) {
        //         var condition = elem.subTotalItem == true;
        //         item = condition ? elem : null;
        //         return condition;
        //     });
        //
        //     jobEstimate.selectNewLine({
        //         sublistId: sublistId
        //     });
        //
        //     suHelper.setCurrentSublistValue(jobEstimate, sublistId, "item", item["itemId"]);
        //     suHelper.setCurrentSublistValue(jobEstimate, sublistId, "quantity", 1);
        //     jobEstimate.commitLine({sublistId: sublistId});
        //     return jobEstimate;
        // }

        // /**
        //  * Adds the Sub Total, Retention, and Discounted Items as needed.
        //  * @param jobMT Data passed into service
        //  * @param jobEstimate Estimate that is being created
        //  * @returns {*}
        //  */
        // function addSpecialItems(jobMT, jobEstimate)
        // {
        //     var retention = jobMT["Retention"] ? parseFloat(jobMT["Retention"]) * 100 : 0;
        //     var discount = jobMT["Discount"] ? parseFloat(jobMT["Discount"]) * 100 : 0;
        //     if (retention > 0 || discount > 0)
        //     {
        //         jobEstimate = createEstimateSubTotalItem(jobEstimate);
        //     }
        //     if (retention)
        //     {
        //         jobEstimate = createEstimateSpeiclaItemLine(jobEstimate, retention, true);
        //     }
        //     if (discount)
        //     {
        //         jobEstimate = createEstimateSpeiclaItemLine(jobEstimate, discount, false);
        //     }
        //     return jobEstimate;
        // }

        //#endregion - Add Special Items -

        /**
         * Add missing items to an array to be returned.
         * @param prodItem
         */
        function addMissingItems(prodItem) {
            try {
                if (!liItemsDontExists) {
                    liItemsDontExists = "Items do not exists : " + prodItem;
                } else {
                    liItemsDontExists += ", " + prodItem;
                }
            } catch (e) {
                log.error('Error in addMissingItems function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        /**
         * Adds list of employees that are not a job resource.
         * @param name
         */
        function addEmployeeResourceError(name) {
            try {
                if (!liJobResourceNotValid) {
                    liJobResourceNotValid = "These employee(s) are not valid to be selected as a job resource : " + name;
                } else {
                    if (liJobResourceNotValid.indexOf(name) == -1) {
                        liJobResourceNotValid += ", " + name;
                    }
                }
            } catch (e) {
                log.error('Error in addEmployeeResourceError function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        /**
         * Add's an item to the estimate
         * @param rec estimate record
         * @param est estimate json value
         * @returns {*}
         */
        function addEstimateItemLine(rec, est) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var sublistId = "item";
                var prodItem = est["Item"];
                var item = getItemFromJson(prodItem);
                if (item) {
                    rec.selectNewLine({
                        sublistId: sublistId
                    });

                    try {
                        suHelper.setCurrentSublistValue(rec, sublistId, "item", item.id);

                        suHelper.setCurrentSublistValue(rec, sublistId, "quantity", parseFloat(est["Actual Number"]));
                        suHelper.setCurrentSublistValue(rec, sublistId, "description", est["Description"]);
                        suHelper.setCurrentSublistValue(rec, sublistId, "custcol_osm_percent_billable", parseFloat(est["Percent Billable"]) * 100);
                        suHelper.setCurrentSublistValue(rec, sublistId, "custcol_osm_multiplier", parseFloat(est["Multiplier"]));
                        suHelper.setCurrentSublistValue(rec, sublistId, "custcol_osm_material_cost_per_item", parseFloat(est["Material Cost Per Item"]));
                        suHelper.setCurrentSublistValue(rec, sublistId, "custcol_osm_total_material_cost", parseFloat(est["Total Material Cost"]));
                        suHelper.setCurrentSublistValue(rec, sublistId, "custcol_price_increase_percentage", parseFloat(est["Price Increase %"]) * 100);
                        suHelper.setCurrentSublistValue(rec, sublistId, "rate", parseFloat(est["Price Per Item"]));
                        // suHelper.setCurrentSublistValue(est, sublistId, "rate",est["item"]);
                        // suHelper.setCurrentSublistValue(est, sublistId,"options",est["item"]);
                        // suHelper.setCurrentSublistValue(est, sublistId,"shipto",est["item"]);
                        // suHelper.setCurrentSublistValue(est, sublistId,"shipcarrier",est["item"]);
                        // suHelper.setCurrentSublistValue(est, sublistId,"shipmethod",est["item"]);
                        // suHelper.setCurrentSublistValue(rec, sublistId, "displayname", est["Description"]);

                        rec.commitLine({
                            sublistId: sublistId
                        });
                    } catch (e) {
                        rec.cancelLine(sublistId);

                        addMissingItems(prodItem);
                        // throw {message: "You have entered an invalid item: " + est["Item"]};
                    }
                } else {
                    addMissingItems(prodItem);
                }
                return rec;
            } catch (e) {
                log.error('Error in addEstimateItemLine function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        function setIfChanged(nsRecord, fieldId, value) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                var prevVal = nsRecord.getValue(fieldId);
                // log.debug("fieldId", fieldId);
                // log.debug("prevVal", prevVal);
                // log.debug("value", value);
                if (!prevVal || prevVal !== value) {
                    nsRecord.setValue(fieldId, value);
                }
                return nsRecord;
            } catch (e) {
                log.error('Error in setIfChanged function', e.name + '=>' + e.message + '=>' + e.stack);
            }
        }

        /**
         * Create's the Job Estimates record associated to the job.
         * @param jobMT
         * @param jobId
         * @param exists
         */
        function addJobEstimates(jobMT, jobId, exists) {

            var jobEstimate;
            if (exists) //Update existing estimate.
            {
                exists = false;
                var estObj = getEstimateFromJson(jobId);
                if (estObj) {
                    jobEstimate = record.load({
                        id: estObj.id,
                        type: record.Type.ESTIMATE,
                        isDynamic: true
                    });
                    exists = true;
                }
            }
            if (!exists) //Create new estimate
            {
                jobEstimate = record.create({
                    type: record.Type.ESTIMATE,
                    isDynamic: true,
                    defaultValues: {
                        customform: fh.getFormId("OSMCustomEstimate")
                    }
                });
            }
            addGov(10);

            jobEstimate = setIfChanged(jobEstimate, "entity", g_lookupVals.customer.id);
            jobEstimate.setValue("job", jobId);
            jobEstimate.setValue("duedate", dmHelper.parseDate(jobMT["Expiration Date"]));
            jobEstimate.setValue("trandate", dmHelper.parseDate(jobMT["Date Prepared"]));

            var dbd = getEmployee(jobMT["Director Of Business Development"]);
            // log.debug("dbd", dbd);
            // log.debug("cur dbd", jobEstimate.getValue("salesrep"));
            if (!dbd) {
                dbd = {};
            }
            try {
                jobEstimate = setIfChanged(jobEstimate, "salesrep", dbd.id);
            } catch (error) {
                var bla = new eHelper.Error(error);
                throw {
                    message: "Employee " + dbd.name + " is not a valid DBD."
                };
            }

            jobEstimate.setValue("class", g_lookupVals.serviceCode.id);
            jobEstimate.setValue("custbody_osm_stacked_billing_sales_ord", dmHelper.parseBool(jobMT["Stacked Billing"]));
            jobEstimate.setValue("custbody_osm_circumference_sales_order", jobMT["Average Circumference"]);
            jobEstimate.setValue("custbody_osm_age_to_visual_sales_ord", jobMT["Age To Visual"]);
            jobEstimate.setValue("custbody_osm_total_ponis_sales_ord", jobMT["Total PONIs"]);
            jobEstimate.setValue("custbody_osm_calc_increase_sales_ord", jobMT["Calc Increase"]);
            jobEstimate.setValue("custbody_osm_actual_increase_sales_ord", jobMT["Actual Increase"]);
            jobEstimate.setValue("location", g_lookupVals.location);

            // format the retention rate if a float to 1 precision decimal point
            var retentionRate = jobMT["Retention"] ? parseFloat(jobMT["Retention"]) * 100 : 0;
            if (retentionRate > 0) {
                if (dmHelper.isFloat(retentionRate)) {
                    retentionRate = retentionRate.toFixed(1);
                }
            }
            log.debug("Retention Rate", "jobMT[Retention]=" + jobMT["Retention"] + " converted Retention=" + retentionRate);
            jobEstimate.setValue("custbody_osm_retention_rate", retentionRate);
            jobEstimate.setValue("custbody_osm_field_discount_rate", jobMT["Discount"] ? parseFloat(jobMT["Discount"]) * 100 : 0);

            var paymentTerm = g_lookupVals.paymentTerms;
            jobEstimate.setValue("terms", paymentTerm);

            var opId = getOpportunityId(jobMT["Opportunity ID"]);

            if (opId) {
                jobEstimate.setValue("custbody_opportunity_id", opId);
            }

            var products = jobMT["Products"];

            //reset the check to null.
            liItemsDontExists = null;
            suHelper.removeAllLines(jobEstimate, "item");

            //loop through all products associated to this estimate and add it to the sublist.
            var dateTime = new Date();
            for (var i in products) {
                var item = jobMT.Products[i];
                jobEstimate = addEstimateItemLine(jobEstimate, item);
            }

            //if the product doesn't exists throw an error with the list of line item's that don't exists.
            if (liItemsDontExists) {
                throw {
                    message: liItemsDontExists
                };
            }

            dateTime = new Date();

            addGov(20);
            var id = jobEstimate.save();

            // cHelper.logTimeDiff(dateTime, "save estimate");
            g_rollbackEstimates.push(id); //if this errors it will delete all added to this array.
            if (opId) {
                dateTime = new Date();
                log.debug("jobid", jobId)
                log.debug("job number", g_jobNo)
                // updateOpportunityJob(opId, jobId, false);

                // cHelper.logTimeDiff(dateTime, "update opportunity job");
            }
        }

        function addJobResource(job, sublistId, jobResourceId, role, name) {


            job.selectNewLine({
                sublistId: sublistId
            });
            try {
                log.debug("AddJobResource", "job: " + job + " , sublistId: " + sublistId + " , jobResourceId: " + jobResourceId + " , role: " + role);
                suHelper.setCurrentSublistValue(job, sublistId, "jobresource", jobResourceId); //employee
                suHelper.setCurrentSublistValue(job, sublistId, "role", role); //role for hte job
                job.commitLine({
                    sublistId: sublistId
                });
            } catch (e) {
                job.cancelLine(sublistId);
                var errMsg = eHelper.getError(e)["message"];
                if (errMsg.indexOf("field: jobresource") > -1) {
                    addEmployeeResourceError(name);
                    log.debug("AddJobResource Error Msg: ", errMsg);
                } else {
                    throw e;
                }
            }
            return errMsg;

        };

        /**
         * Add's the use and their role to the job.
         * @param job job record
         * @param roleId role of the person for the job
         * @param jobResourceId employee id
         * @param sublistId sublist name
         * @returns {*}
         */
        function addJobResourceRoleLine(job, roleId, jobResourceId, name, sublistId) {

            // Added by try catch block Nagarro Team to capture the error on 30/7/24

            try {
                // log.debug("roleid", roleId);
                // log.debug("name", name);
                for (var i in roleId) {
                    var role = roleId[i];

                    var lineNumber = job.findSublistLineWithValue({
                        sublistId: sublistId,
                        fieldId: "role",
                        value: role
                    });

                    // log.debug("lineNumber", lineNumber);
                    if (!dmHelper.isNullOrEmpty(lineNumber) && lineNumber >= 0) {
                        job.selectLine({
                            sublistId: sublistId,
                            line: lineNumber
                        });

                        var empId = job.getCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "jobresource",
                            // line: lineNumber
                        });
                        // log.debug("empid", empId);
                        // log.debug("jobResourceId", jobResourceId);

                        if (empId != jobResourceId) {
                            addJobResource(job, sublistId, jobResourceId, role, name);
                        }
                    } else {
                        addJobResource(job, sublistId, jobResourceId, role, name);
                    }
                }
                return job;
            } catch (e) {
                log.error('Error in addJobResourceRoleLine function', e.name + '=>' + e.message + '=>' + e.stack);
            }

        }

        /**
         * Add's resource roles to the job
         * @param jobMT json job
         * @param job job record
         * @returns {*}
         */
        function addJobResourceRoles(jobMT, job) {

            var sublistId = "jobresources";
            var jobResources = [];
            var employees = [];

            // var bla = [];

            //Creates the object array that will be looped through to add job resources.

            jobResources.push({
                role: "5",
                id: getEmployee(jobMT[g_contrAdmin]).id
            });
            jobResources.push({
                role: "4",
                id: getEmployee(jobMT[g_projEst]).id
            });
            jobResources.push({
                role: "3",
                id: getEmployee(jobMT[g_dbd]).id
            });
            jobResources.push({
                role: "1",
                id: getEmployee(jobMT[g_genMan]).id
            });
            jobResources.push({
                role: "2",
                id: getEmployee(jobMT[g_manOpProjLead]).id
            });

            // log.debug("jobResources", lodash.sortBy(jobResources, 'role'));


            var count = job.getLineCount({
                sublistId: sublistId
            });

            // log.debug("inRecordAlready", lodash.sortBy(bla, 'role'));
            // log.debug("test", lodash.xorBy(jobResources, bla, ['id', 'role']));

            //Get employee id's and create the array that will be used to create the job resources.
            for (var i in employeeJSON) {
                var hope = [];
                var emp = employeeJSON[i];
                var obj = {
                    id: emp.id,
                    name: emp.name
                };
                for (var j in jobResources) {
                    var jobRes = jobResources[j];
                    if (jobRes.id == emp.id) {
                        hope.push(jobRes.role);
                    }
                }
                obj.roles = hope;
                employees.push(obj);
            }

            // suHelper.removeAllLines(job, sublistId);
            for (var i = 0; i < employees.length; i++) {
                var resource = employees[i];
                if (resource.roles.length >= 1) {
                    // log.debug("resource", resource);
                    //Add to job resource role.
                    job = addJobResourceRoleLine(job, resource.roles, Number(resource.id), resource.name, sublistId);
                }
            }

            //remove updated Resrouce/Roles.
            for (var i = count - 1; i >= 0; i--) {
                var id = job.getSublistValue({
                    sublistId: sublistId,
                    fieldId: "jobresource",
                    line: i
                });

                var role = job.getSublistValue({
                    sublistId: sublistId,
                    fieldId: "role",
                    line: i
                });

                //Check if this line still exists.
                var jobResc = lodash.find(jobResources, {
                    role: role,
                    id: id
                });

                //If this line no longer exists, remove it.
                if (!jobResc) {
                    log.debug("jobResc", jobResc);
                    job.removeLine({
                        sublistId: sublistId,
                        line: i
                    });
                }
            }

            // throw "testing 2";

            return job;

        }

        //Set's up the main section of the job.
        function setupJob(jobMT, job) {

            var servCodeField = "custentity_osm_job_service_code";

            //Get the IDs by matching the passed in number/text to the NetSuite IDs.
            g_lookupVals = getLookupValues(jobMT);

            g_jobNo = jobMT["Job ID"];

            //#region - Add To Job Main -
            job.setValue("entityid", jobMT["Job ID"]);
            job.setValue("autoname", dmHelper.parseBool(false));
            job.setValue("subsidiary", g_lookupVals.subsidiary);
            job.setValue("custentity_osm_job_sales_territory", g_lookupVals.territory.id);
            job.setValue("altname", jobMT["Job Name"]);
            job.setValue("companyname", jobMT["Job Name"]);
            // job.setValue("custentity_osm_job_contract_id", jobMT["Project ID"]);

            job.setValue("custentity_osm_job_actual_start_date", dmHelper.parseDate(jobMT["Start Date"]));
            job.setValue("enddate", dmHelper.parseDate(jobMT["End Date"]));
            job.setValue(servCodeField, g_lookupVals.serviceCode.id);
            job.setValue("custentity_osm_job_last_year_worked", jobMT["Last Year Worked"]);
            job.setValue("custentity_osm_job_revenue_baseline", jobMT["Revenue Baseline"]);
            job.setValue("custentity_osm_job_revenue_expected", jobMT["Revenue Expected"]);
            job.setValue("estimatedrevenue", jobMT["Estimated Revenue"]);
            job.setValue("custentity_osm_job_manhours_per_unit_bas", jobMT["Manhours Per Unit Base"]);
            job.setValue("custentity_osm_job_manhours_per_unit_exp", jobMT["Manhours Per Unit Expected"]);
            job.setValue("custentity_osm_job_sales_per_week_base", jobMT["Sales Per Week Base"]);
            job.setValue("custentity_osm_job_sales_per_week_exp", jobMT["Sales Per Week Expected"]);
            job.setValue("custentity_osm_job_labor_unit_base", jobMT["Labor Per Unit Base"]);
            job.setValue("custentity_osm_job_labor_per_unit_exp", jobMT["Labor Per Unit Expected"]);
            job.setValue("custentity_osm_job_calendar_weeks", jobMT["Calendar Weeks"]);
            job.setValue("custentity_osm_job_revenue_pct", jobMT["Revenue %"]);
            job.setValue("custentity_osm_job_directlabor_baseline", jobMT["Direct Labor Baseline"]);
            job.setValue("custentity_osm_job_directlabor_expected", jobMT["Direct Labor Expected"]);
            job.setValue("custentity_osm_job_direct_labor_pcs", jobMT["Direct Labor %"]);
            job.setValue("custentity_osm_job_material_baseline", jobMT["Material Baseline"]);
            job.setValue("custentity_osm_job_material_expected", jobMT["Material Expected"]);
            job.setValue("custentity_osm_job_material_pct", jobMT["Material %"]);
            job.setValue("custentity_osm_job_overhead_baseline", jobMT["Overhead Baseline"]);
            job.setValue("custentity_osm_job_overhead_expected", jobMT["Overhead Expected"]);
            job.setValue("custentity_osm_job_overhead_pct", jobMT["Overhead %"]);
            job.setValue("custentity_osm_job_gp_baseline", jobMT["Gross Profit Baseline"]);
            job.setValue("custentity_osm_job_gp_expected", jobMT["Gross Profit Expected"]);
            job.setValue("custentity_osm_job_gp_pct", jobMT["Gross Profit %"]);
            job.setValue("custentity_osm_job_avg_crew_member_wage", jobMT["Avg Crew Member Wage"]);
            job.setValue("custentity_total_cms_including_insp", jobMT["Total CMs Including Insp."]);
            job.setValue("custentity_osm_job_inspector_age", jobMT["Inspector Wage"]);
            job.setValue("custentity_osm_job_foreman_wage", jobMT["Foreman Wage"]);
            job.setValue("custentity_osm_job_premium_pay", jobMT["Premium Pay"]);
            job.setValue("custentity_osm_job_total_labor_per_hour", jobMT["Total Labor Per Hour"]);
            job.setValue("custentity_osm_job_crew_size", jobMT["Crew Size"]);
            job.setValue("custentity_osm_job_union_number", jobMT["Union Number"]);
            job.setValue("custentity_osm_job_no_poni_crew_hr_base", jobMT["# Of PONIs Per Crew Hour Base"]);
            job.setValue("custentity_osm_job_no_poni_crew_hr_exp", jobMT["# Of PONIs Per Crew Hour Expected"]);
            job.setValue("custentity_osm_job_no_units_crew_hr_base", jobMT["# Of Units Per Crew Hour Base"]);
            job.setValue("custentity_osm_job_no_units_crew_hr_exp", jobMT["# Of Units Per Crew Hour Expected"]);
            job.setValue("custentity_osm_job_ponis_per_day_base", jobMT["PONIs Per Day Base"]);
            job.setValue("custentity_osm_job_ponis_per_day_exp", jobMT["PONIs Per Day Expected"]);
            job.setValue("custentity_psm_job_ponis_per_week_base", jobMT["PONIs Per Week Base Bonus"]);
            job.setValue("custentity_osm_job_ponis_per_week_exp", jobMT["PONIs Per Week Expected"]);
            job.setValue("custentity_osm_job_base_expected_base", jobMT["Base/Expected Base"]);
            job.setValue("custentity_osm_job_base_expected_exp", jobMT["Base Expected Expected"]);
            job.setValue("custentity_osm_job_avg_wage_manhour_base", jobMT["Avg Wage Per Manhour Base"]);
            job.setValue("custentity_osm_job_avg_wage_manhour_exp", jobMT["Avg Wage Per Manhour Expected"]);
            job.setValue("custentity_osm_job_oh_per_manhour_base", jobMT["OH Per Manhour Base"]);
            job.setValue("custentity_osm_job_oh_per_manhour_exp", jobMT["OH Per Manhour Expected"]);
            job.setValue("custentity_osm_job_total_manhour_base", jobMT["Total Manhour Base"]);
            job.setValue("custentity_osm_job_total_manhour_exp", jobMT["Total Manhour Expected"]);
            job.setValue("custentity_osm_job_total_unit_base", jobMT["Total Units Base"]);
            job.setValue("custentity_osm_job_total_unit_exp", jobMT["Total Units Expected"]);
            job.setValue("custentity_osm_job_cost_of_extras_base", jobMT["Cost Of Extras Base"]);
            job.setValue("custentity_osm_job_cost_of_extras_exp", jobMT["Cost Of Extras Expected"]);
            job.setValue("custentity_osm_job_matr_cost_unit_base", jobMT["Material Cost Per Unit Base"]);
            job.setValue("custentity_osm_job_matr_cost_unit_exp", jobMT["Material Cost Per Unit Expected"]);
            job.setValue("custentity_osm_job_total_cost_unit_base", jobMT["Total Cost Per Unit Base"]);
            job.setValue("custentity_osm_job_total_cost_unit_exp", jobMT["Total Cost Per Unit Expected"]);
            job.setValue("custentity_osm_job_profit_base", jobMT["Profit Base"]);
            job.setValue("custentity_osm_job_profit_exp", jobMT["Profit Expected"]);
            job.setValue("custentity_osm_job_crew_weeks_need_base", jobMT["Crew Weeks Needed Base"]);
            job.setValue("custentity_osm_job_crew_weeks_need_exp", jobMT["Crew Weeks Needed Expected"]);
            job.setValue("custentity_osm_job_sales_crew_hour_base", jobMT["Sales Per Crew Hour Base"]);
            job.setValue("custentity_osm_job_sales_crew_hour_exp", jobMT["Sales Per Crew Hour Expected"]);
            job.setValue("custentity_osm_job_crew_needed_base", jobMT["Crews Needed Base"]);
            job.setValue("custentity_osm_job_crews_needed_exp", jobMT["Crews Needed Expected"]);
            job.setValue("custentity_osm_job_units_per_pole", jobMT["Units Per PONI"]);
            job.setValue("custentity_osm_job_total_units", jobMT["Total Units"]);
            job.setValue("custentity_osm_job_sales_per_unit", jobMT["Sales Per Unit"]);
            job.setValue("custentity_osm_job_sales_unit_base", jobMT["Sales Per Unit"]);
            job.setValue("custentity_osm_job_sales_per_unit_exp", jobMT["Sales Per Unit"]);
            job.setValue("custentity_osm_job_price_per_poni", jobMT["Price Per PONI"]);
            job.setValue("custentity_osm_job_collection_system", jobMT["Collection System"]);
            job.setValue("custentity_osm_job_gps_accuracy", jobMT["GPS Accuracy"]);
            job.setValue("custentity_osm_ext_job_description", jobMT["Extended Job Description"]);
            // if(g_lookupVals.entityStatus)
            // {
            job.setValue("entitystatus", g_lookupVals.entityStatus.id);
            // }
            job.setValue("custentity_osm_job_digital_images", dmHelper.parseBool(jobMT["Digital Images"]));
            job.setValue("custentity_osm_job_resolution", jobMT["Resolution"]);
            job.setValue("custentity_osm_job_osmose_online_data", dmHelper.parseBool(jobMT["Osmose Online Data"]));
            job.setValue("custentity_osmsdf_job_viewer", dmHelper.parseBool(jobMT["Viewer"]));
            job.setValue("custentity_osm_job_fastgate_manager", dmHelper.parseBool(jobMT["Fastgate Manager"]));
            job.setValue("custentity_osm_job_strengthcalc", dmHelper.parseBool(jobMT["StrengthCalc"]));
            job.setValue("custentity_osm_job_loadcalc", dmHelper.parseBool(jobMT["LoadCalc"]));
            job.setValue("custentity_osm_job_customer_landbase", dmHelper.parseBool(jobMT["Customer Landbase"]));
            job.setValue("custentity_osm_job_customer_data", dmHelper.parseBool(jobMT["Customer Data"]));
            job.setValue("custentity_osm_job_weekly_addl_cost_base", jobMT["Additional Job Costs Per Week Base"]);
            job.setValue("custentity_osm_job_weekly_addl_cost_exp", jobMT["Additional Job Costs Per Week Expected"]);
            job.setValue("custentity_osm_job_total_addl_cost_base", jobMT["Additional Total Job Costs Base"]);
            job.setValue("custentity_osm_job_total_addl_cost_exp", jobMT["Additional Total Job Costs Expected"]);
            job.setValue("custentity_osm_job_pct_above_base_exp", jobMT["Percentage Above Required"]);
            job.setValue("limittimetoassignees", false);
            job.setValue("parent", g_lookupVals.customer.id);
            job.setValue("custentity_osm_job_work_state", g_lookupVals.workState.id);

            var estimate = jobMT["JobEstimates"][0];
            if (estimate) {
                var opId = getOpportunityId(estimate["Opportunity ID"]);
                job.setValue("custentity_opportunity", opId);
            }
            //#endregion

            return job;

        }

        /**
         * Deletes the additional costs.
         * @param jobId
         */
        function deleteAdditionalCosts(jobId) {
            var additCostList = additionalCostJSON.filter(function (value) {
                return value.jobId == jobId;
            });

            for (var i = additCostList.length; i--;) {
                deleteRecord("customrecord_osm_addl_job_cost_details", additCostList[i].id);
            }

        }

        /**
         * Creates a project ID if it doesn't exists.
         * @param jobs
         * @param projId
         * @returns ProjectID
         */
        function getCreateProjectID(jobs, projId) {

            var columns = [{
                name: "isinactive",
                sort: "DESC"
            }, {
                name: "internalid",
                sort: "ASC"
            }, "name"];
            var filters = sHelper.createFilter(jobs, [], "Project ID", "name");
            projIdsJSON = sHelper.getSearchResultsObj("customrecord_osm_project_id", columns, filters);

            //Get the single active job if available.
            var objProjJob = sHelper.getResult(projIdsJSON, ["name", "isinactive"], [projId, false]);

            //If there are no active jobs, use this to return the first inactive job so that it can be re-activated.
            if (!objProjJob) {
                objProjJob = sHelper.getResult(projIdsJSON, "name", projId);
            }

            var internalId = objProjJob ? objProjJob["internalid"] : null;
            if (!internalId) {
                var recProj = record.create({
                    type: "customrecord_osm_project_id"
                });
                recProj.setValue("name", projId);
                return recProj.save();
            } else if (objProjJob["isinactive"]) {
                record.submitFields({
                    type: "customrecord_osm_project_id",
                    id: internalId,
                    values: {
                        isinactive: false
                    }
                });
            }

            return internalId;

        }


        /**
         * Updates the project job relationship record to have the project ID and the job.
         * @param jobs
         * @param jobInternalId
         * @param jobName
         * @param projId
         * @param jobExists
         * @returns {*}
         */
        function updateProjJobRelationship(jobs, jobInternalId, jobName, projId, jobExists) {

            var id;

            var columns = ["internalid", "custrecord_osm_project_id", "custrecord_osm_job_id"];
            // returns list of Proj Jobs that match the project ID (honestly, I'm not sure why this was the filter used)
            var filterss = sHelper.createFilter(jobs, [], "Project ID", "custrecord_osm_project_id.name");

            // returns list of Proj Jobs that match the job number
            var filters = sHelper.createFilter(jobs, [], "Job ID", "custrecord_osm_job_id.entityid");

            projJobsJSON = sHelper.getSearchResultsObj("customrecord_osm_project_job", columns, filters);

            var projJob = sHelper.getObjFromSearchResults(projJobsJSON, "custrecord_osm_job_id", jobInternalId.toString());
            var recProj;

            if (jobExists) {
                //If Project Job Relation exists, update it.
                if (projJob) {
                    var internalId = projJob["internalid"];
                    id = internalId;
                    if (projId != projJob["custrecord_osm_project_id"]) {
                        record.submitFields({
                            type: "customrecord_osm_project_job",
                            id: internalId,
                            values: {
                                custrecord_osm_project_id: projId,
                                name: jobName
                            }
                        });
                        //log.debug("1", 1);

                        // projJob = sHelper.getObjFromSearchResults(projJobsJSON, "custrecord_osm_job_id", jobInternalId.toString());
                    }
                } else //Create the Project Job Relationship.
                {
                    recProj = record.create({
                        type: "customrecord_osm_project_job"
                    });
                    recProj.setValue("custrecord_osm_job_id", jobInternalId);
                    recProj.setValue("custrecord_osm_project_id", projId);
                    recProj.setValue("name", jobName);
                    //log.debug("2", 2);
                    id = recProj.save();
                }
            }
            //If project job relationship doesn't exists, create it.
            else {
                recProj = record.create({
                    type: "customrecord_osm_project_job"
                });
                recProj.setValue("custrecord_osm_job_id", jobInternalId);
                recProj.setValue("custrecord_osm_project_id", projId);
                recProj.setValue("name", jobName);
                //log.debug("3", 3);
                // id = recProj.save();
            }
            return id;
        }

        /**
         * Create's the job and estimate to be added
         * @param jobs
         * @param jobMT JSON job
         * @returns {*}
         */
        function createJob(jobs, jobMT) {

            g_bExists = false;
            var jobObj = getJobFromJson(jobMT["Job ID"]);
            var projIdForProjJob;
            var job;

            if (!jobMT["Project ID"]) {
                throw {
                    name: "EMPTY_PROJECT_ID",
                    message: "Invalid Project Id. Project Id is required. Job - " + jobMT["Job ID"]
                };
            }

            var customForm = fh.getFormId("OSMJobForm");
            if (jobObj) {
                job = record.load({
                    id: jobObj.id,
                    type: record.Type.JOB,
                    isDynamic: true
                });

                g_bExists = true;
            } else {
                job = record.create({
                    type: record.Type.JOB,
                    isDynamic: true,
                    defaultValues: {
                        customform: customForm
                    }
                });
                g_bExists = false;
            }
            // cHelper.logTimeDiff(dateTime, "load or create job");
            addGov(5);

            //Adds non sublist data to the job record.

            job = setupJob(jobMT, job);



            //Adds all employee roles to this job.
            job = addJobResourceRoles(jobMT, job, g_bExists);

            if (liJobResourceNotValid) {
                throw {
                    message: liJobResourceNotValid
                };
            }

            var jobId = job.save();
            // g_jobId = job.save();

            //add or update project and project job relationships
            projIdForProjJob = getCreateProjectID(jobs, jobMT["Project ID"]);
            updateProjJobRelationship(jobs, jobId, jobMT["Job Name"], projIdForProjJob, g_bExists);

            record.submitFields({
                type: "job",
                id: jobId,
                values: {
                    custentity_osm_job_contract_id: projIdForProjJob
                }
            });

            addGov(10);
            //================= update by yogesh on 12-05-2025, then 15-05-2025 worktype list created===========================================
            if (jobId && jobMT['WorkTypes'] && Array.isArray(jobMT['WorkTypes'])) {
                log.debug('WorkTypes Array', JSON.stringify(jobMT['WorkTypes']));

                var jobRec = record.load({
                    id: jobObj.id,
                    type: record.Type.JOB,
                    isDynamic: true
                });

                for (var w = 0; w < jobMT['WorkTypes'].length; w++) {
                    var workTypeObj = jobMT['WorkTypes'][w];

                    if (workTypeObj.Active) {
                        var description = workTypeObj.Description;

                        // Defensive string check
                        if (description && typeof description.toString === 'function') {
                            var workType = description.toString().trim();
                            log.debug('Processing Active WorkType', workType);

                            jobRec.selectNewLine('recmachcustrecord_osm_relationship_job');
                            jobRec.setCurrentSublistValue('recmachcustrecord_osm_relationship_job', 'name', workType);
                            jobRec.commitLine('recmachcustrecord_osm_relationship_job');
                        } else {
                            log.debug('Skipping non-string Description', JSON.stringify(description));
                        }
                    } else {
                        log.debug('Skipping Inactive WorkType', JSON.stringify(workTypeObj));
                    }
                }

                var jobRecId = jobRec.save();
                log.debug('Job Updated With Active WorkTypes Only', jobRecId);
            }



            var addJobInfo = jobMT["AdditionalJobInfo"];
            //Add additional costs

            var deleted = false;
            //Delete additional costs when updating a job instead of looping through and editing existing and deleting ones removed.
            for (var i in addJobInfo) {
                if (g_bExists && !deleted) {
                    deleteAdditionalCosts(jobId);
                    deleted = true;
                }
                //Add additional costs.
                addAdditionalCosts(addJobInfo[i], jobId, g_bExists);
            }

            var jobEstimates = jobMT["JobEstimates"];
            //Add job estimate and products
            for (var i in jobEstimates) {
                addJobEstimates(jobEstimates[i], jobId, g_bExists);
            }
            // cHelper.logTimeDiff(dateTime, "job estimate");
            return job;

        }

        //Creates the filter to search for employees for faster results.
        function getEmployeeFilter(jobs) {
            var list = [];
            sHelper.createFilter(jobs, list, g_projEst, "entityid");
            sHelper.createFilter(jobs, list, g_contrAdmin, "entityid");
            sHelper.createFilter(jobs, list, g_dbd, "entityid");
            sHelper.createFilter(jobs, list, g_genMan, "entityid");
            sHelper.createFilter(jobs, list, g_manOpProjLead, "entityid");
            sHelper.createFilterComplex1(jobs, list, "AdditionalJobInfo", "Last Edited By", "entityid");
            sHelper.createFilterComplex1(jobs, list, "JobEstimates", "Director Of Business Development", "entityid");
            return list;
        }

        //Creates the filter to search for customers for faster results.
        function getCustomers(jobs) {
            var list = [];
            return sHelper.createFilter(jobs, list, "Customer", "entityid");
        }

        //Creates filter for item search.
        function getItems(jobs) {
            var list = [];
            return sHelper.createFilterComplex2(jobs, list, "JobEstimates", "Products", "Item", "itemid");
        }

        //creates filters for opportunity search.
        function getOpportunities(jobs) {
            var list = [];
            return sHelper.createFilterComplex1(jobs, list, "JobEstimates", "Opportunity ID", "tranid");
        }

        //creates filters for opportunity search.
        function getJobs(jobs, column) {
            var list = [];
            return sHelper.createFilter(jobs, list, "Job ID", column);
        }

        //delete's the record passed in.
        function deleteRecord(type, id) {
            // log.debug("type", type);
            // log.debug("id", id);
            addGov(5);
            record.delete({
                type: type,
                id: id
            })
        }

        //Creates the filter to search for customers for faster results.
        function getTermFilter(jobs) {
            var list = [];
            return sHelper.createFilterComplex1(jobs, list, "JobEstimates", "PaymentTerms", "name");
        }

        //Rollback changes for job if it failed at any level.
        function rollback(jobId) {
            var obj = {};

            //#region Logging what is to be deleted
            if (jobId) {
                obj.job = {
                    jobId: jobId,
                    jobNumber: g_jobNo
                }
            }
            if (g_rollbackEstimates.length >= 1) {
                obj.Estimates = {
                    estimates: g_rollbackEstimates
                }
            }
            if (g_rollbackAdditCost.length >= 1) {
                obj.AdditionalCost = {
                    "Additional Cost": g_rollbackAdditCost
                }
            }
            if (g_rollbackOpportunities.length >= 1) {
                obj.Opportunities = {
                    "Opportunities to remove job from": g_rollbackOpportunities
                }
            }
            // log.debug("Data to be deleted", obj);
            //#endregion

            //order matters.
            //if estimates exists, delete it.
            if (g_rollbackEstimates.length >= 1) {
                for (var index in g_rollbackEstimates) {
                    deleteRecord(record.Type.ESTIMATE, g_rollbackEstimates[index]);
                }
            }
            // if (g_rollbackOpportunities.length >= 1)
            // {
            //     for (var index in g_rollbackOpportunities)
            //     {
            //         updateOpportunityJob(g_rollbackOpportunities[index], jobId, true);
            //     }
            // }

            //order doesn't matter.
            //if additional costs exists, delete it.
            if (g_rollbackAdditCost.length >= 1) {
                for (var index in g_rollbackAdditCost) {
                    deleteRecord("customrecord_osm_addl_job_cost_details", g_rollbackAdditCost[index]);
                }
            }
            //if job was created, deleted it.
            if (jobId) {
                deleteRecord("job", jobId);
            }
        }

        function calculateGov(amount, multiplier) {
            if (multiplier) {
                return multiplier.length * amount;
            } else {
                return amount
            }
        }

        /**
         * Run's a search that will get all needed internal IDs based off the value sent in.
         * @param jobs
         */
        function setupSearchResults(jobs) {
            territoriesJSON = jobHelper.getTerritories();

            serviceCodeJSON = jobHelper.getServiceCode();
            entityStatusJSON = jobHelper.getEntityStatus();

            customerJSON = jobHelper.getCustomers(getCustomers(jobs));

            employeeJSON = jobHelper.getEmployees(getEmployeeFilter(jobs));
            itemsJSON = jobHelper.getItems(getItems(jobs));
            opportunityJSON = jobHelper.getOpportunities(getOpportunities(jobs));
            jobJSON = jobHelper.getJobs(getJobs(jobs, "entityid"));
            additionalCostJSON = jobHelper.getAdditionalCosts(jobJSON);
            estimateJSON = jobHelper.getEstimates(jobJSON);
            termsJSON = sHelper.getSearchResultsObj("term", ["internalid", "name"], getTermFilter(jobs));
            var columns = ["internalid", "name", "isinactive"];
            var filters = sHelper.createFilter(jobs, [], "Project ID", "name");
            projIdsJSON = sHelper.getSearchResultsObj("customrecord_osm_project_id", columns, filters);

            columns = ["internalid", "custrecord_osm_project_id", "custrecord_osm_job_id"];
            filters = sHelper.createFilter(jobs, [], "Project ID", "custrecord_osm_project_id.name");
            projJobsJSON = sHelper.getSearchResultsObj("customrecord_osm_project_job", columns, filters);

            statesJSON = jobHelper.getStates();

            return statesJSON
        }

        function addJobID(e) {
            try {
                e["id"] = g_jobNo;
            } catch (ex) { }
            return e;
        }

        function _post(jobs) {
            var jobobject = {};
            var dateTime = new Date();

            // Setup the return object
            var objSuccess = {
                FailureCount: 0,
                SuccessCount: 0,
                OverallCount: 0,
                Errors: [],
                FailedData: [],
                Governance: 0,
            };

            try {
                if (JSON.stringify(jobs).length > 3998) {
                    log.debug("json sent to me", new Date());
                } else {
                    log.audit("full json", jobs);
                }
                log.debug('jobs', jobs);
                // Parses the data sent and performs necessary searches to get NetSuite IDs
                setupSearchResults(jobs);
                //Get's all of the governance used.
                addGov(jobHelper.getGov());
            } catch (e) {
                log.error("Setup error", eHelper.getError(e));
                emailHelper.sendEmail("Job Import Error", JSON.stringify(eHelper.getError(e)), emailHelper.get.JOB_IMPORT());
                return eHelper.getError(e);
            }

            for (var i in jobs) {
                //  objSuccess.OverallCount++;
                // Reset current global job info
                g_jobId = null;
                g_jobNo = null;
                g_rollbackAdditCost = [];
                g_rollbackEstimates = [];

                var job = jobs[i];
                jobobject = getJobFromJson(job["Job ID"]);
                log.debug('jobinternalid', jobobject);

                var nextGov = 15;
                //Calculates the governance it would take to delete the current job so that if deleting it adds too much governance, it won't try to add it.
                // + 30 for each estimate because of loading and removing job, and saving opportunities.
                var deleteGov = 5 + calculateGov(5, job["AdditionalJobInfo"]) + //additional cost governance for this job.
                    calculateGov(5, job["JobEstimates"]) + //job estimate governance for this job.
                    calculateGov(30, job["JobEstimates"]); //adding job to opportunity governance for this job.

                var jobId = "";

                try {
                    nextGov += calculateGov(11, job["AdditionalJobInfo"]);
                    nextGov += calculateGov(4, job["JobEstimates"]);
                    nextGov += calculateGov(30);
                    //only attempt to create the job if the governance to create and delete it doesn't exceed 5000.
                    if (governance + nextGov + deleteGov > 5000) {
                        throw new Error("You have exceeded the governance allowed for this call.");
                    }

                    jobId = createJob(jobs, job);
                    if (jobId) {
                        objSuccess.SuccessCount++;
                    }

                    // }
                } catch (e) {
                    log.error("Error in creating job", e.name + '=>' + e.message + '=>' + e.stack);
                    objSuccess.FailureCount++;
                    if (typeof jobobject === 'object' && !Array.isArray(jobobject) && jobobject !== null) {
                        objSuccess.FailedData.push({
                            jobId: jobobject.jobId
                        });
                    }
                    else {
                        objSuccess.FailedData.push({
                            jobId: 'Job Id not found'
                        });
                    }
                    objSuccess.Errors.push(eHelper.getError(e));
                    e = addJobID(e);
                    emailHelper.sendEmail("Job Import Error", JSON.stringify(eHelper.getError(e)) + "\n\n" + JSON.stringify(job), emailHelper.get.JOB_IMPORT());

                    if (jobId) {
                        try {
                            if (!g_bExists) {
                                rollback(jobId);
                            } else {
                                log.error("Unable to roll back", g_jobNo);
                            }
                        } catch (rollbackError) {
                            objSuccess.Errors.push(eHelper.getError(rollbackError));
                        }
                    }
                }

                objSuccess.Governance = governance;
                objSuccess.OverallCount++;
            }
            return objSuccess;
        }


        return {
            post: _post
        }
    }
);