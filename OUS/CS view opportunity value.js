/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: OSM|CS Display Opportunity Value Next to SFA Forecast in Edit mode
 * Description: This User Event script displays the Opportunity Value in the SFA Forecast subtab content
 *              and attempts to append it to the tab title in view mode.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.15    | 2025-07-07 | Yogesh           | Display Opportunity Value Next to SFA Forecast in Edit mode |
 */


/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define(['N/currentRecord', 'N/search', 'N/log'], (currentRecord, search, log) => {

    // Mapping between header and forecast record fields
    const nsIds = {
        oppProjectedTotal: 'projectedtotal',
        oppForecast: 'customrecord_opportunity_forecast',
        oppForecast_relatedOpp: 'custrecord_related_opportunity',
        oppForecast_amount: 'custrecord_opportunity_forecast_amount'
    };

    // Entry point for page initialization in edit mode
    function pageInit(context) {
        try {
            if (context.mode !== 'edit') {
                return;
            }

            const currentRec = context.currentRecord;
            log.debug({
                title: 'pageInit',
                details: `Mode: ${context.mode}, Record ID: ${currentRec.id}, Record Type: ${currentRec.type}`
            });

            // Get Opportunity Value
            const opportunityValue = currentRec.getValue(nsIds.oppProjectedTotal) || 0;
            log.debug({
                title: 'Opportunity Value',
                details: `Opportunity Value: ${opportunityValue}`
            });

            // Search for existing forecast records
            const forecastSearch = search.create({
                type: nsIds.oppForecast,
                filters: [[nsIds.oppForecast_relatedOpp, search.Operator.IS, currentRec.id]],
                columns: [search.createColumn({ name: nsIds.oppForecast_amount })]
            }).run().getRange({ start: 0, end: 1000 }) || [];

            let totalForecastAmount = 0;
            if (forecastSearch.length > 0) {
                forecastSearch.forEach(result => {
                    totalForecastAmount += parseFloat(result.getValue(nsIds.oppForecast_amount)) || 0;
                });
                log.debug({
                    title: 'Total Forecast Value',
                    details: `Total Forecast Value: ${totalForecastAmount}`
                });
            }

            // Format the total forecast amount
            totalForecastAmount = ' ($' + Helpers.formatNumber(totalForecastAmount) + ')';

            // Update the SFA Forecast subtab title
            Helpers.updateSubtabTitle('SFA Forecast', 'totalSFAForecastAmount', totalForecastAmount);

        } catch (error) {
            log.error({
                title: 'Error in pageInit',
                details: `Error: ${error.message}, Stack: ${error.stack}`
            });
        }
    }

    // Helper functions
    const Helpers = (function () {
        function updateSubtabTitle(subtabTitle, newTitleId, newTitle) {
            try {
                const formTabs = jQuery('.formtabtext');

                let tabs = formTabs;
                if (formTabs.length && jQuery(formTabs[0]).is('div')) {
                    tabs = jQuery('.formtabtext a');
                }

                for (let i = 0; i < tabs.length; i++) {
                    if (tabs[i].textContent.indexOf(subtabTitle) > -1) {
                        if (jQuery('#' + newTitleId).length === 0) {
                            jQuery(tabs[i]).append(
                                jQuery('<span>', {
                                    id: newTitleId,
                                    html: newTitle
                                })
                            );
                        } else {
                            jQuery('#' + newTitleId).html(newTitle);
                        }
                        break;
                    }
                }
            } catch (e) {
                log.error({
                    title: 'Error in updateSubtabTitle',
                    details: `Error: ${e.message}, Stack: ${e.stack}`
                });
            }
        }

        function formatNumber(number) {
            try {
                if (!isNaN(number)) {
                    const fixedNumber = parseFloat(number).toFixed(2);
                    const splitNumber = fixedNumber.split('.');
                    let leftNumber = '';
                    let placeCount = 1;
                    for (let i = splitNumber[0].length - 1; i >= 0; i--) {
                        let comma = '';
                        if ((placeCount - 1) % 3 === 0 && i !== splitNumber[0].length - 1) {
                            comma = ',';
                        }
                        leftNumber = splitNumber[0][i] + comma + leftNumber;
                        placeCount++;
                    }
                    if (!splitNumber[1]) {
                        splitNumber[1] = '00';
                    } else if (splitNumber[1].length === 1) {
                        splitNumber[1] = splitNumber[1] + '0';
                    }

                    return leftNumber + '.' + splitNumber[1];
                }
                return '';
            } catch (e) {
                log.error({
                    title: 'NUMBER_FORMAT_ERROR',
                    details: `Error: ${e.message}, Number: ${number}, Stack: ${e.stack}`
                });
                return '';
            }
        }

        return {
            updateSubtabTitle: updateSubtabTitle,
            formatNumber: formatNumber
        };
    })();

    return {
        pageInit: pageInit
    };
});