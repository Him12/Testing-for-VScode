/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define([], function () {
    function pageInit(context) {
        try {
            // Locate the Attach button using its text or HTML ID
            var attachButton = document.querySelector('input[value="Attach"]'); // Use the Attach button's value
            if (attachButton) {
                attachButton.style.display = 'none'; // Hide the button
            }
        } catch (error) {
            console.error('Error hiding Attach button:', error);
        }
    }

    return {
        pageInit: pageInit
    };
});
