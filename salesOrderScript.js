/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
 define(['N/currentRecord'], function(currentRecord) {
    function pageInit(context){
        alert("pageint started");
        console.log("pageinit working");
        var currentRecord = context.currentRecord;
        currentRecord.setValue({
            fieldId: 'entity',
            value:'C:0001 GM Corporate'
        });
        currentRecord.setValue({
            fieldId:'memo',
            value:'himanshu-first-test'

        });
        currentRecord.setValue({
            fieldId:'otherrefnum',
            value:112233
        });
        currentRecord.setValue({
            fieldId:'orderstatus',
            value:'Pending Approval'
        });
    }
    
    return{
        pageInit: pageInit,
    };
 });