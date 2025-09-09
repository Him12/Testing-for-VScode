/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/url', '/SuiteScripts/custom/updation_bpc_bb_rest_lib'],
  (log, url, library) => {

    const onRequest = (context) => {
      log.debug('Suitelet Invoked', {
        method: context.request.method,
        url: context.request.url,
        body: context.request.body || 'No body provided',
        headers: context.request.headers
      });

      if (context.request.method === 'GET') {
        try {
          const params = context.request.parameters;
          const { record_id, emailType } = params;

          // Case 1: No params → just return Suitelet external URL
          if (!record_id && !emailType) {
            const suiteletUrl = url.resolveScript({
              scriptId: 'customscript_bb_email_suitelet',
              deploymentId: 'customdeploy_ng_email_suitelet',
              returnExternalUrl: true
            });

            context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
            context.response.write(JSON.stringify({
              success: true,
              message: 'Suitelet URL resolved successfully',
              suiteletUrl
            }));
            return;
          }

          // record_id is required
          if (!record_id) {
            throw new Error('Missing required parameter: record_id');
          }
          if (!emailType) {
            throw new Error('Missing required parameter: emailType');
          }

          let payload;

          switch (emailType) {
            case 'Giftee':
              payload = library.buildGifteePayloadFromRecord(record_id);
              break;

            case 'Shipped':
              payload = library.buildShippedPayloadFromRecord(record_id);
              break;

            case 'SalesOrderSummary':
              payload = library.processSalesOrderSummary(record_id);
              break;

            case 'ReturnOrderSummary':
            case 'ReturnOrderOversized':
              const rmaData = library.lookupReturnAuthorizationFields(record_id);
              if (!rmaData || rmaData.length === 0) {
                throw new Error(`No data found for RMA ${record_id}`);
              }

              let labelSubtotal = 0;
              rmaData.forEach((row) => {
                labelSubtotal += (parseFloat(row.totalrestockingfee) || 0) + (parseFloat(row.labelfee) || 0);
              });
              const labelSubtotalStr = labelSubtotal.toFixed(2);

              if (emailType === 'ReturnOrderSummary') {
                payload = library.buildReturnOrderSummaryPayload(rmaData, {}, labelSubtotalStr);
              } else if (emailType === 'ReturnOrderOversized') {
                if (!library.isOversizedRma(rmaData)) {
                  throw new Error('This RMA is not oversized, no oversized payload generated');
                }
                payload = library.buildReturnOrderOversizedPayload(rmaData, {}, labelSubtotalStr);
              }
              break;

            case 'Refund Confirmation':
              payload = library.buildRefundConfirmationPayloadFromRecord(record_id);
              break;

            case 'Cancelled':   // ✅ NEW
              log.debug('Cancellation Payload - Params', {
                record_id,
                emailType
              });

              // Look up the SO status before building payload
              try {
                const soStatusQuery = `
            SELECT status
            FROM transaction
            WHERE id = ?
              AND recordtype = 'salesorder'
        `;
                const statusResult = library.processSuiteQL(soStatusQuery, [record_id]);
                if (statusResult && statusResult.length > 0) {
                  log.debug('Sales Order Status', statusResult[0].status);
                } else {
                  log.debug('Sales Order Status', 'No record found');
                }
              } catch (statusErr) {
                log.error('Error fetching SO status', statusErr);
              }

              payload = library.buildCancellationPayloadFromRecord(record_id);
              break;

            default:
              throw new Error(
                `Invalid emailType: ${emailType}. Supported: Giftee, Shipped, SalesOrderSummary, ReturnOrderSummary, ReturnOrderOversized, Refund Confirmation, Cancelled`
              );
          }

          context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
          context.response.write(JSON.stringify({
            success: true,
            message: 'Payload generated successfully',
            payload
          }));

        } catch (e) {
          log.error('GET Processing Error', e);
          context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
          context.response.write(JSON.stringify({
            success: false,
            error: e.message
          }));
        }
        return;
      }

      // Unsupported methods
      context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
      context.response.write(JSON.stringify({
        success: false,
        error: 'Only GET is supported in this Suitelet'
      }));
    };

    return { onRequest };
  });
