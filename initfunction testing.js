/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define([], function() {
    function pageInit(context){
        var currentRecord = context.currentRecord;
        currentRecord.setValue({
            fieldId:'',
            value:''
        });
        currentRecord.setValue({
            fieldId:'',
            value:''
        });
        currentRecord.setValue({
            fieldId:'',
            value:5
        });
    }
    return{
        pageInit:pageInit
    }
});