/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 *@NModuleScope Public
 *@NAmdConfig  /SuiteScripts/Source/Libs/helperConfig.json
 */
 define(["N/file", "mapReduceHelper", "commonHelper", "N/sftp", "N/record", "moment", "searchHelper", "emailHelper", "dmHelper", "errorHelper",
    "fileHandler", "encodeHelper", "sftpHandler"],
function (file, mrHelper, cmHelper, ftp, record, moment, sHelper, emHelper, dmHelper, erHelper, fiHandler, encHelper, sftp)
{
    function getFileList()
    {
        return [cmHelper.getScriptParameterValue("custscript_osm_active_import_file_name")];
        // return [
        //     "Hourly_Activity_Output.csv",
        //     "Salary_Activity_Output.csv"
        // ];
    }

    function isFileContentSame(prevFileData, downloadedFile)
    {
        prevFileData = prevFileData || "";
        downloadedFile = downloadedFile || "";

        // log.debug("prevFileData", prevFileData);
        // log.debug("downloadedFile", downloadedFile);
        log.debug("prevFileData.trim() == downloadedFile.trim()", prevFileData.trim() == downloadedFile.trim());
        // return false;
        // if (prevFileData.trim() != downloadedFile.trim() && !dmHelper.isNilOrEmpty(downloadedFile.trim()))
        if (prevFileData.trim() == downloadedFile.trim() || dmHelper.isNilOrEmpty(downloadedFile.trim()))
        {
            log.debug("true", true);
            return true;
        }
        else
        {
            log.debug("false", false);
            return false
        }
    }

    function getInputData()
    {
        var list = getFileList();
        log.debug("list", list);
        var returnObj = [];
        for (var i = 0; i < list.length; i++)
        {
            try
            {
                var fileName = list[i];
                var fileDescription = getFileDescription(fileName);
                var downloadedFile = sftp.getFileData(sftp.KRONOS, "/WIM_OUT", fileName);
                log.debug("downloadFile.error: ", downloadedFile.error);
                // log.debug("ended testing", "ended testing")
                // return; /// USED FOR PROD TESTING TO STOP PROCESSING - KRONOS DID NOT GIVE US A SANDBOX AFTER THEIR SECURITY BREACH IN LATE 2021

                if (downloadedFile.error)
                {
                    throw downloadedFile;
                }

                var prevFileData = getPrevFileData(fileName);
                //If the file is the same as previous file, do nothing.
                //If the FTP file is empty do nothing.
                log.debug("isFileContentSame(prevFileData, downloadedFile)", isFileContentSame(prevFileData, downloadedFile));

                if (isFileContentSame(prevFileData, downloadedFile) == false)
                {
                    emHelper.sendEmail("Time Tracking DATA", JSON.stringify(dmHelper.csvToJSON(downloadedFile)), emHelper.get.DEVELOPER());
                    // log.debug("downloadedFile", dmHelper.csvToJSON(downloadedFile));
                    // log.debug("downloadedFile.length", dmHelper.csvToJSON(downloadedFile).length);

                    // log.debug("my length", dmHelper.csvToJSON(downloadedFile));
                    returnObj = returnObj.concat(dmHelper.csvToJSON(downloadedFile));
                    // log.debug("returnObj", returnObj);
                    var fileObj = file.create({
                        name: fileName,
                        description: fileDescription,
                        fileType: file.Type.CSV,
                        folder: fiHandler.KRONOS,
                        contents: encHelper.encrypt(downloadedFile)
                    });
                    fileObj.save();
                    // uploadEmptyFile(connection);

                    // return dmHelper.csvToJSON(downloadedFile);
                }
                else
                {
                    return [];
                }
            }
            catch (e)
            {
                emHelper.sendEmail("Time Tracking Error", erHelper.getError(e), emHelper.get.KRONOS_TIME_IMPORT());
                var myError = new erHelper.Error(e);
                log.debug("myError", myError);
                myError.throw();
                throw erHelper.getError(e);
            }
        }
        log.debug("returnObj.length", returnObj.length);
        return returnObj;
    }

    function getFileDescription(fileName)
    {
        var fileDescription = "Salary Kronos Time Import";
        if (fileName == "Hourly_Activities_Output.csv")
        {
            fileDescription = "Hourly Kronos Time Import"
        }
        return fileDescription;
    }

    function map(context)
    {
        try
        {
            var mapData = mrHelper.getMapData(context);
            log.debug("mapdata", mapData);
            var empNo = dmHelper.empNumber(mapData.EmployeeNumber).toString();
            // if (!(empNo == "072035" || empNo == "067837" || empNo == "031854" || empNo == "060922"))
            // {
            // log.debug("hi", "hello");
            createTimeBillEntry(mapData, empNo);
            // }
        }
        catch (e)
        {
            log.debug("error", erHelper.getError(e));
            context.write(mapData, e);
        }
    }

    function summarize(summary)
    {
        var message = "";
        var employee = "";

        //Email Table Headers
        var headers = ["Employee", "Message", "Error", "Values"];

        // emHelper.sendEmail("ELLO", "hi", emHelper.get.DEVELOPER());

        summary.output.iterator().each(function (key, errors)
        {
            key = JSON.parse(key);  //Data of employee and week day.
            if (dmHelper.isJson(errors))
            {
                errors = JSON.parse(errors);
            }
            var errMessage = errors.message;
            //If no error message, set the message = to the error as it is most likely a string. i.e. Employee {#} does not exists.
            if (!errMessage)
            {
                errMessage = errors;
            }
            //If there is an employee number, display that on the email.
            // if (key.length > 0)
            // {
            employee = dmHelper.empNumber(key["EmployeeNumber"]);
            // }
            message += emHelper.emailBodyString(emHelper.fillInColumns(headers, [employee, errMessage, JSON.stringify(errors), JSON.stringify(key)]));
            return true;
        });

        if (message)
        {
            message = emHelper.emailHeaderString(headers, true) + message;
            message += emHelper.emailFooterString(message);
        }

        var body = "";
        var subj = "Time Entry Errors";
        if (message)
        {
            body = message;
        }
        if (!body)
        {
            subj = "Successful Time Import";
            body = "No errors were recorded when importing the Kronos time entries.";
        }

        log.debug("message", message);

        emHelper.sendEmail(subj, body, emHelper.get.KRONOS_TIME_IMPORT());
        summary.mapSummary.errors.iterator().each(function (key, error)
        {
            log.error('Reduce Error for key: ' + key, error);
            // errors = true;
            return true;
        });

        summary.reduceSummary.errors.iterator().each(function (key, error)
        {
            log.error('Reduce Error for key: ' + key, error);
            // errors = true;
            return true;
        });
    }

    function createTimeBillEntry(mapData, empNo)
    {
        // log.debug("mapdata", mapData);
        var newRec = record.create({
            type: "timebill",
            isDynamic: true
        });

        newRec.setValue("employee", getEmployeeInternalID(empNo));
        newRec.setValue("trandate", moment(mapData.Date).toDate());
        newRec.setValue("supervisorapproval", dmHelper.parseBool(mapData.ApprovalStatus) ? true : false);
        // Keep this line in case they decide to allow time to come in as unapproved from Kronos. We've been told to force it to approve everything
        // newRec.setValue("approvalstatus", dmHelper.parseBool(mapData.ApprovalStatus) ? 3 : 2);

        // Per Denise Martin we are to set the status coming in as always approved
        newRec.setValue("approvalstatus", 3);
        newRec.setValue("hours", mapData.Hours);
        var projId = mapData["ProjectID"];
        // log.debug("projId", projId);
        // log.debug("dmHelper.isNilOrEmpty(projId) ? projId : null", !dmHelper.isNilOrEmpty(projId) ? projId : null);

        newRec.setText("custcol_osm_project_id", !dmHelper.isNilOrEmpty(projId) ? projId : null);
        // newRec.setText("custcol_osm_project_id", "AEPPSO20180001");

        // log.debug("mapdata", mapData)
        var job = mapData["Job"];
        // var job = "1023096";
        if (job)
        {
            var jobResult = new sHelper.Search("job", ["internalid", "entityid"], ["entityid", "is", job]).firstOrDefault();
            if (jobResult)
            {
                job = jobResult.internalid;
            }
            newRec.setValue("custcol_osmose_job", job);
        }
        // newRec.setText("custcol_osm_pto_note", "Vacation");
        // newRec.setText("custcol_osm_time_tracking_category", "App Prep");
        newRec.setText("custcol_osm_pto_note", mapData["PTOType"]);
        newRec.setValue("memo", mapData["Memo"]);


        var category = mapData["EngineeringTimeTrackingCategory"];
        // log.debug("category", category);
        if (category)
        {
            category = category.replace(/  +/g, ' ').trim();
        }
        // log.debug("category", "'" + category + "'");

        newRec.setText("custcol_osm_time_tracking_category", category);
        // log.getValue("my memo", newRec.getValue("memo"));
        newRec.save();
    }

    function getPrevFileData(fileName)
    {
        var prevFileData = "";
        try
        {
            // log.debug("1", 1);
            var prevFile = file.load({
                id: "Script Saved Files/" + fileName
            });
            prevFileData = prevFile.getContents();
            return encHelper.decrypt(prevFileData);
        }
        catch (e)
        {
            var myErr = erHelper.getError(e);
            // log.debug("e", myErr)
            if (myErr.name != "RCRD_DSNT_EXIST" && myErr.message != "Malformed UTF-8 data")
            {
                log.debug("myErr", myErr);
                throw myErr;
            }
            return prevFileData
        }
    }

    function uploadEmptyFile(connection)
    {
        var emptyFile = file.create({
            name: 'Activities_Output.csv',
            fileType: file.Type.CSV,
            contents: " "
        });

        connection.upload({
            directory: sftp.getRoot(sftp.KRONOS) + '/WIM_OUT',
            filename: 'Activities_Output.csv',
            file: emptyFile,
            replaceExisting: true
        });
    }

    function getEmployeeInternalID(empNumber, values, context)
    {
        // log.debug("empNumber", empNumber);
        empNumber = dmHelper.empNumber(empNumber);
        // log.debug("empNumber after", empNumber);
        var filters = ["entityid", "is", empNumber];
        var columns = ["internalid", "entityid"];
        // log.debug("ftilers", filters);
        // log.debug("columns", columns);

        var employee = new sHelper.Search("employee", columns, filters).firstOrDefault();

        if (employee)
        {
            return employee.internalid
        }
        else
        {
            // log.error("Employee Number " + empNumber + " does not exists.");
            throw "Employee Number " + empNumber + " does not exists."
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    }
}
);
