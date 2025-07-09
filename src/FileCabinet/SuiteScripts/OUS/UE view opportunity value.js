/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: OSM|Display Opportunity Value Next to SFA Forecast
 * Description: This User Event script displays the Opportunity Value in the SFA Forecast subtab content
 *              and attempts to append it to the tab title in view mode.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.15    | 2025-07-07 | yogesh           | Display Opportunity Value Next to SFA Forecast view mode |
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define(['N/record', 'N/search'], (record, search) => {

    // Mapping between header and forecast record fields
    const nsIds = {
        oppProjectedTotal: 'projectedtotal',
        oppForecast: 'customrecord_opportunity_forecast',
        oppForecast_relatedOpp: 'custrecord_related_opportunity',
        oppForecast_amount: 'custrecord_opportunity_forecast_amount',
        viewModeSFAScriptField: 'custbody_sfa_view_mode_script',
    };

  
    function beforeLoad(context) {
        try {
            if (context.type !== context.UserEventType.VIEW) {
                return;
            }

            const newRec = context.newRecord;
			let form = context.form;
            log.debug({
                title: 'beforeLoad',
                details: `Event Type: ${context.type}, Record ID: ${newRec.id}, Record Type: ${newRec.type}`
            });

            // Get Opportunity Value
            const opportunityValue = newRec.getValue(nsIds.oppProjectedTotal) || 0;
            log.debug({
                title: 'Opportunity Value',
                details: `Opportunity Value: ${opportunityValue}`
            });

            // Search for existing forecast record
            const forecastSearch = search.create({
                type: nsIds.oppForecast,
                filters: [[nsIds.oppForecast_relatedOpp, search.Operator.IS, newRec.id]],
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
			
			totalForecastAmount = ' ($' + Helpers.formatNumber(totalForecastAmount)+')';

            var scriptText = '<scr' + 'ipt>' +

                'var Helpers = {};' +
                'Helpers.formatNumber = ' + String(Helpers.formatNumber) + ';' +
                'Helpers.updateSubtabTitle = ' + String(Helpers.updateSubtabTitle) + ';' +
                'var _updateOppSFAForecastSubtabTitle = ' + String(_updateOppSFAForecastSubtabTitle) + ';' +
                
                'jQuery(document).ready(function() {' +
                '_updateOppSFAForecastSubtabTitle(\'' + totalForecastAmount + '\');' +
                '});' +
                '</scr' + 'ipt>';



            var field = form.getField(nsIds.viewModeSFAScriptField);
            if (field) {
                field.defaultValue = scriptText;
                log.debug('Script Text set to field', scriptText);

            } else {
                log.error('Field not found', 'Field ID: ' + nsIds.viewModeScriptField);
            }

            if (newRecord.getValue(nsIds.oppCompetition) !== nsVals.competition.other) {
                field = form.getField(nsIds.oppCompetitionOther);
                field.updateDisplayType({ displayType: 'hidden' });
            }

        } catch (error) {
            log.error({
                title: 'Error in beforeLoad',
                details: `Error: ${error.message}, Stack: ${error.stack}`
            });
        }
    }

    var Helpers = (function () {

        function _updateSubtabTitle(subtabTitle, newTitleId, newTitle) {
            var formTabs = jQuery('.formtabtext');

            if (formTabs.length && jQuery(formTabs[0]).is('div')) {
                formTabs = jQuery('.formtabtext a');
            }

            for (i = 0; i < formTabs.length; i += 1) {
                if (formTabs[i].text.search(subtabTitle) > -1) {
                    if (jQuery('#' + newTitleId).length === 0) {
                        jQuery(formTabs[i]).append(
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
        }

        function _formatNumber(number) {
            try {
                if (!isNaN(number)) {
                    var fixedNumber = parseFloat(number).toFixed(2);
                    var splitNumber = fixedNumber.split('.');
                    var leftNumber = '';
                    var placeCount = 1;
                    for (var i = splitNumber[0].length - 1; i >= 0; i -= 1) {
                        var comma = '';
                        if ((placeCount - 1) % 3 === 0 && i !== splitNumber[0].length - 1) {
                            comma = ',';
                        }
                        leftNumber = splitNumber[0][i] + comma + leftNumber;
                        placeCount += 1;
                    }
                    if (splitNumber[1] === undefined) {
                        splitNumber[1] = '00';
                    } else if (splitNumber[1].length === 1) {
                        splitNumber[1] = splitNumber[1] + '0';
                    }

                    return leftNumber + '.' + splitNumber[1];
                }
                return '';
            } catch (e) {
                throw error.create({
                    name: 'NUMBER_FORMAT_ERROR',
                    message: e + ' >>> ' + number + ' <<<',
                    notifyOff: true
                });
            }
        }
        return ({
            updateSubtabTitle: _updateSubtabTitle,
            formatNumber: _formatNumber
        });
    })();

    function _updateOppSFAForecastSubtabTitle(amount) {
        Helpers.updateSubtabTitle('SFA Forecast', 'totalSFAForecastAmount', amount);
    }

    return { beforeLoad };
});