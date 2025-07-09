/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget','N/search'],
    /**
 * @param{serverWidget} serverWidget
 */
    (ui,search) => {
        var exports = {};
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2 
         */
        const onRequest = (scriptContext) => {

/************Sales order */
function getSalesOrders() {
    var salesOrders = search.create({
        type: "salesorder",
        filters: [
            ["type", "anyof", "SalesOrd"],
            "AND",
            ["mainline", "is", "T"],
            "AND",
            ["internalid", "anyof", '22121']
        ],
        columns:
            [
                search.createColumn({ name: "entity", label: "Name" }),
                search.createColumn({ name: "trandate", label: "Date" })
            ]
    });
    return salesOrders;
}
     /************Sales order end */
     
     
if(scriptContext.request.method=='GET')
{
    let form=ui.createForm({
        title: 'Hello World Suitelet' ,
        hideNavBar: true
    })
   
    // form.clientScriptModulePath = 'SuiteScripts/Suitelettest.js';
    form.addSubmitButton({
        label: 'Submit!'
    })
    form.addButton({
        id: 'custpage_say_hello',
        label: 'Say Hello!',
        functionName: 'sayHelloToUser'
    })
    form.addField({
        id: 'custpage_test_field',
        label: 'Enter Hello...',
        type: ui.FieldType.TEXT,
    });
    var sublist = form.addSublist({
        id: 'custpage_sales_orders',
        type: ui.SublistType.LIST,
        label: 'Sales Orders'
    });
    sublist.addField({
        id: 'custpage_name',
        label: 'Customer Name',
        type: ui.FieldType.TEXT
    })
    sublist.addField({
        id: 'custpage_date',
        label: 'Date',
        type: ui.FieldType.DATE
    })
/***************************************************** */
var salesOrders = getSalesOrders(); // <—— HERE
var counter = 0;
            salesOrders.run().each(function(result) {
                log.debug("result", result);
                var customerName = result.getText('entity');
                var tranDate = result.getValue('trandate');
                sublist.setSublistValue({
                    id: 'custpage_name',
                    line: counter,
                    value: customerName
                });
                sublist.setSublistValue({
                    id: 'custpage_date',
                    line: counter,
                    value: tranDate
                });
                counter++;
                return true;
            })

/********************************************** */
    scriptContext.response.writePage(form);

    log.debug('suitelet is GET')

}
else if (scriptContext.request.method=='POST')
{
    log.debug('suitelet is posting')
}


        }
       exports.onRequest = onRequest;
        return exports;

    });
