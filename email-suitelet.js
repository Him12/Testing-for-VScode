/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/email', 'N/log'], function(email, log) {

    function onRequest(context) {
        if (context.request.method === 'POST') {
            var requestBody = JSON.parse(context.request.body);
            var author = requestBody.author;
            var recipient = requestBody.recipient;
            var subject = requestBody.subject;
            var body = requestBody.body;

            try {
                email.send({
                    author: author,
                    recipients: recipient,
                    subject: subject,
                    body: body
                });

                context.response.write('Email sent successfully.');
            } catch (error) {
                log.error('Error sending email', error);
                context.response.write('Failed to send email: ' + error.message);
            }
        }
    }

    return {
        onRequest: onRequest
    };
});
