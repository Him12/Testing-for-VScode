/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/task', 'N/ui/serverWidget'], function(task, serverWidget) {
    function onRequest(context) {
        // Create the form
        var form = serverWidget.createForm({
            title: 'Run URL Extraction'
        });

        if (context.request.method === 'GET') {
            form.addSubmitButton({
                label: 'Start URL Extraction'
            });
        } else {
            // Trigger the Map/Reduce script
            var mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscriptcustscript_script_urls_extra', // ID of your Map/Reduce script
                deploymentId: 'customdeploy1' // Deployment ID of your Map/Reduce script
            });

            var mrTaskId = mrTask.submit();

            form.addField({
                id: 'custpage_task_status',
                type: serverWidget.FieldType.LABEL,
                label: 'Map/Reduce Task Submitted with ID: ' + mrTaskId
            });

            
        }

        // Display the form
        context.response.writePage(form);
    }

    return {
        onRequest: onRequest
    };
});
