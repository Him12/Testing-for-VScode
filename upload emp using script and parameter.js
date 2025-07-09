/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/log', 'N/record', 'N/runtime'], function(file, log, record, runtime) {

    function getInputData() {
        try {
            log.debug('Step 1: Start getInputData', 'Fetching CSV file by ID...');

            // Get script parameter for File ID
            var scriptObj = runtime.getCurrentScript();
            var fileId = scriptObj.getParameter({ name: 'custscripttcustscript_csv_file_path' });

            if (!fileId) {
                log.error('Error', 'File ID parameter is missing. Provide a valid file ID.');
                return [];
            }

            // Load file using file ID
            var fileObj = file.load({ id: fileId });
            log.debug('Step 2: File Loaded', 'File Name: ' + fileObj.name);

            var fileContents = fileObj.getContents();
            log.debug('Step 3: File Contents Read', fileContents.length > 500 ? fileContents.substring(0, 500) + '...' : fileContents);

            var lines = fileContents.split(/\r?\n/);
            log.debug('Step 4: File Split into Lines', 'Total Lines: ' + lines.length);

            if (lines.length < 2) {
                log.error('Error', 'CSV file is empty or contains only headers.');
                return [];
            }

            var headers = lines[0].split(',').map(function(h) { return h.trim(); });
            log.debug('Step 5: Headers Extracted', headers);

            var employees = [];

            for (var i = 1; i < lines.length; i++) {
                var columns = lines[i].split(',').map(function(c) { return c.trim(); });
                log.debug('Step 6: Processing Line ' + i, columns);

                if (columns.length >= 6) {
                    employees.push({
                        id: i,  
                        firstName: columns[0] || '',
                        lastName: columns[1] || '',
                        jobTitle: columns[2] || '',
                        supervisor: columns[3] || '',
                        email: columns[4] || '',
                        phone: columns[5] || ''
                    });
                }
            }

            log.debug('Step 7: Employee List Ready', employees.length + ' Employees Parsed');
            return employees;

        } catch (error) {
            log.error('Error in getInputData', error.message);
            return [];
        }
    }

    function map(context) {
        try {
            log.debug('Step 8: Processing Employee', 'Data: ' + context.value);

            var employeeData = JSON.parse(context.value);

            var employeeRec = record.create({
                type: record.Type.EMPLOYEE,
                isDynamic: true
            });

            employeeRec.setValue({ fieldId: 'firstname', value: employeeData.firstName });
            employeeRec.setValue({ fieldId: 'lastname', value: employeeData.lastName });
            employeeRec.setValue({ fieldId: 'title', value: employeeData.jobTitle });

            if (employeeData.supervisor && !isNaN(employeeData.supervisor)) {
                employeeRec.setValue({ fieldId: 'supervisor', value: parseInt(employeeData.supervisor) });
            }

            employeeRec.setValue({ fieldId: 'email', value: employeeData.email });
            employeeRec.setValue({ fieldId: 'phone', value: employeeData.phone });

            var employeeId = employeeRec.save();
            log.debug('Step 9: Employee Saved', 'Employee ID: ' + employeeId);

        } catch (error) {
            log.error('Error in map function', error.message);
        }
    }

    function summarize(summary) {
        summary.output.iterator().each(function(key, value) {
            log.audit('Processed Employee', 'Key: ' + key + ', Value: ' + value);
            return true;
        });

        log.debug('Step 10: Summary Complete', 'Script Execution Finished');
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});