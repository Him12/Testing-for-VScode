/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: OSM|CS Opportunity Client Script
 * Description: This Client Script manages opportunity-related functionality, including:
 *              - Displaying Opportunity Value next to SFA Forecast subtab in edit mode.
 *              - Updating sales process question totals, handling market sector changes, and managing competition fields.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.15    | 2025-07-07 | Yogesh           | Display Opportunity Value Next to SFA Forecast in Edit mode |
 */

/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define(['N/ui/dialog', 'N/runtime', 'N/currentRecord', 'N/record', 'N/search', 'N/ui/message', 'N/log', 'N/error'], 
       function(dialog, runtime, currentRecord, record, search, message, log, error) {

    // Mapping between header and forecast record fields
    var nsIds = {
        program: 'custbody_program',
        capAndThreshFieldGroup: ['fieldGroup245', 'fieldGroup149', 'fieldGroup262'],
        phasesDay: 'custbody_phase_cap_daily',
        phasesWeek: 'custbody_phase_cap_weekly',
        phasesMonth: 'custbody_phase_cap_monthly',
        monthlyCap: 'custbody_monthly_charge_cap',
        invoiceGrouping: 'custbody_invoice_grouping',
        invoiceSubGrouping: 'custbody_invoice_subgrouping',
        expectedStartDate: 'custbody_expected_start_date',
        previousExpectedStartDate: 'custbody_prev_expected_start_date',
        guaranteeType: 'custbody_guarantee_type',
        sentToCustomer: 'custbody_sent_to_customer',
        reportsSentPercentage: 'custbody_report_sent_percentage',
        soContractStatus: 'custbody_contract_status',
        soContractStatusDate_ReceievedContract: 'custbody_csd_contract_received',
        soContractStatusDate_ChangeRequestReviewed: 'custbody_csd_change_request_reviewed',
        soContractStatusDate_ChangeRequestSent: 'custbody_csd_change_request_sent',
        soContractStatusDate_AddtlDocsSent: 'custbody_csd_addtl_docs_sent',
        soContractStatusDate_SignedContract: 'custbody_csd_imcorp_signed_contract',
        soContractStatusDate_ReceivedFullyExecContract: 'custbody_csd_rec_executed_contract',
        soContractStatusDate_HandedOffToOps: 'custbody_csd_handed_off_to_ops',
        tranFieldOwnerName: 'custbody_owner_name',
        termsAndConditions: 'custbody_terms_and_conditions',
        signatureSection: 'custbody_signature_section',
        printTemplateContentRecord: 'customrecord_print_template_content',
        printTemplateContentRecordContent: 'custrecord_print_template_content',
        soOrderStatus: 'orderstatus',
        soQuoteAndCOTotal: 'custbody_quote_and_co_total',
        soApprovedTotal: 'custbody_approved_so_total',
        soRemainingDays: 'custbody_remaining_days',
        soIsComplete: 'custbody_sales_order_is_complete',
        quoteProbability: 'probability',
        quoteStatus: 'entitystatus',
        quoteForecast: 'forecasttype',
        quoteCO: 'custbody_co_number',
        quotePendingCOs: 'custbody_pending_cos',
        quoteContactEmail: 'custbody_quote_to_email',
        quoteRev: 'custbody_quote_revision',
        quoteRelSO: 'custbody_related_sales_order',
        quoteRelatedSalesOrders: 'custbody_related_sales_orders',
        quoteNumMDUs: 'custbody_num_of_mdus',
        quoteId: 'custbody_project_id',
        quoteOriginalAmount: 'custbody_original_quote_amount',
        soPendingCOs: 'custbody_pending_cos_pointer',
        soQuoteCurrentCO: 'custbody_co_number_pointer',
        tranDate: 'trandate',
        siteName: 'custbody_test_site_area',
        jobSiteState: 'custbody_job_site_state',
        projectCountry: 'custbody_project_country',
        projectState: 'custbody_project_state',
        suiteScript_stateSearch: 'customsearch_ss_state_search',
        monthlyWorkHours: 'custbody_monthly_work_hours',
        overrideMonthlyWorkHours: 'custbody_override_monthly_work_hours',
        oppProjectedTotal: 'projectedtotal',
        oppCompetition: 'custbody_competition',
        oppCompetitionOther: 'custbody_competition_other',
        oppCalculatedDays: 'custbody_calculated_days',
        oppAveragedOppValue: 'custbody_averaged_opportunity_value',
        oppForecastTotal: 'custbody_opportunity_forecast_total',
        oppLastInvoiceDate: 'custbody_last_invoice_date',
        oppMarketType: 'custbody_market_type',
        oppMarketSector: 'custbody_market_sector',
        oppMarketSectorScripted: 'custpage_market_sector',
        yesterdaysBillableAmount: 'custbody_yesterdays_billable_amount',
        columnOriginalPrice: 'custcol_original_price',
        columnPercentDiscount: 'custcol_percent_discount',
        columnPriorQuantity: 'custcol_prior_quantity',
        columnCO: 'custcol_change_order',
        viewModeScriptField: 'custbody_view_mode_script',
        entity: 'entity',
        opportunity: 'opportunity',
        oppTitle: 'title',
        oppSalesProcess_TotalPercent: 'custbody_sp_total_percent',
        oppSalesProcess_QualificationPercent: 'custbody_sp_qualification_percent',
        oppSalesProcess_ProjectScopePercent: 'custbody_sp_project_scope_percent',
        oppSalesProcess_ClientEducationPercent: 'custbody_sp_client_education_percent',
        oppSalesProcess_KeyStakeholdersPercent: 'custbody_sp_key_stakeholders_percent',
        oppSalesProcess_SystemOperationPercent: 'custbody_sp_system_operation_percent',
        oppSalesProcess_PropNegotPercent: 'custbody_sp_prop_negot_percent',
        oppSalesProcess_VoltageClass: 'custbody_voltage_class',
        oppSalesProcess_LineToGroundVoltage: 'custbody_line_to_ground',
        oppSalesProcess_InstallType: 'custbody_install_type',
        oppSalesProcess_CableInsulationType: 'custbody_cable_insulation_type',
        oppSalesProcess_CableShieldType: 'custbody_cable_shield_type',
        oppSalesProcess_CableConductorType: 'custbody_cable_conductor_type',
        oppForecast: 'customrecord_opportunity_forecast',
        oppForecast_relatedOpp: 'custrecord_related_opportunity',
        oppForecast_date: 'custrecord_opportunity_forecast_date',
        oppForecast_amount: 'custrecord_opportunity_forecast_amount',
        oppForecast_notes: 'custrecord_opportunity_forecast_notes',
        oppForecast_invoiceStatus: 'custrecord_opp_forecast_invoice_status',
        tierPricingQuantityX: 'custbody_tier_pricing_quantity_',
        tierPricingPriceX: 'custbody_tier_pricing_price_',
        oppForecastInvoiceStatuses: 'customlist_opp_fore_invoice_statuses',
        customerAreas: 'customrecord_customer_areas',
        customerAreas_relatedCustomer: 'custrecord_related_customer',
        customerAreas_tier1: 'custrecord_tier_1_area',
        customerAreas_tier2: 'custrecord_tier_2_area',
        probability: 'probability',
        customerCompanyReference: 'custentity_company_reference',
        customerSeniorContact: 'custentity_senior_person',
        customerMarketType: 'custentity_market_type',
        customerMarketSector: 'custentity_market_sector',
        customerMarketSectorScripted: 'custpage_market_sector',
        columnQuotedRate: 'custcol_quoted_rate',
        columnQuotedQuantity: 'custcol_quoted_quantity'
    };

    var nsVals = {
        OkStatus: 2,
        customerStatus: {
            closedLost: 16,
            closedWon: 13
        },
        forecast: {
            high: 3,
            medium: 2,
            low: 1,
            omitted: 0
        },
        competition: {
            other: 6
        },
        quoteStatus: {
            pending: 1,
            approved: 2
        },
        customerAreaForms: {
            site: 32,
            area: 54
        },
        programTierPricingTierLevelCount: 6,
        items: {
            phaseSurchargeWeekly: 39,
            phaseSurchargeMonthly: 40,
            phaseSurchargeDaily: 187,
            daily8HourAssessmentService: 20,
            weeklyAssessmentService: 21,
            monthlyAssessmentService: 22,
            daily10HourAssessmentService: 26,
            HVDailyAssessmentService: 55,
            eveWknd8HourAssessmentService: 27,
            eveWknd10HourAssessmentService: 28,
            holiday8HourAssessmentService: 29,
            holiday10HourAssessmentService: 30,
            standbyWeather: 37
        },
        contractStatuses: {
            notStarted: 3,
            contractReceived: 12,
            changeRequestReviewed: 1,
            changeRequestsSent: 10,
            addtlDocsSent: 4,
            signedContract: 5,
            receivedFullyExecContract: 11,
            handedOffToOps: 2
        },
        priceLevels: {
            basePrice: 1,
            authorizedDiscount20: 6,
            custom: -1
        },
        oppForecastInvoiceStatus: {
            reconciled: 1,
            inProgress: 2,
            unknown: 3
        },
        opportunityTemplates: {
            renewable: 230
        },
        quoteTemplates: {
            renewable: 230
        },
        voltageClasses: {
            class35kv: 4
        },
        installTypes: {
            directBuried: 1
        },
        insulationTypes: {
            trxlpe: 2
        },
        shieldTypes: {
            concentric: 1
        },
        conductorTypes: {
            strand: 1
        },
        countries: {
            unitedStates: 230
        }
    };

    // Helper functions
    var Helpers = (function () {
        function updateSubtabTitle(subtabTitle, newTitleId, newTitle) {
            try {
                var formTabs = jQuery('.formtabtext');
                var tabs = formTabs;
                if (formTabs.length && jQuery(formTabs[0]).is('div')) {
                    tabs = jQuery('.formtabtext a');
                }
                for (var i = 0; i < tabs.length; i++) {
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
                    details: 'Error: ' + e.message + ', Stack: ' + e.stack
                });
            }
        }

        function formatNumber(number) {
            try {
                if (!isNaN(number)) {
                    var fixedNumber = parseFloat(number).toFixed(2);
                    var splitNumber = fixedNumber.split('.');
                    var leftNumber = '';
                    var placeCount = 1;
                    for (var i = splitNumber[0].length - 1; i >= 0; i--) {
                        var comma = '';
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
                    details: 'Error: ' + e.message + ', Number: ' + number + ', Stack: ' + e.stack
                });
                return '';
            }
        }

        return {
            updateSubtabTitle: updateSubtabTitle,
            formatNumber: formatNumber
        };
    })();

    function pageInit(context) {
        try {
            // SFA Forecast subtab logic
            if (context.mode === 'edit') {
                var currentRec = context.currentRecord;
                log.debug({
                    title: 'pageInit - SFA Forecast',
                    details: 'Mode: ' + context.mode + ', Record ID: ' + currentRec.id + ', Record Type: ' + currentRec.type
                });

                // Get Opportunity Value
                var opportunityValue = currentRec.getValue(nsIds.oppProjectedTotal) || 0;
                log.debug({
                    title: 'Opportunity Value',
                    details: 'Opportunity Value: ' + opportunityValue
                });

                // Search for existing forecast records
                var forecastSearch = search.create({
                    type: nsIds.oppForecast,
                    filters: [[nsIds.oppForecast_relatedOpp, search.Operator.IS, currentRec.id]],
                    columns: [search.createColumn({ name: nsIds.oppForecast_amount })]
                }).run().getRange({ start: 0, end: 1000 }) || [];

                var totalForecastAmount = 0;
                if (forecastSearch.length > 0) {
                    forecastSearch.forEach(function(result) {
                        totalForecastAmount += parseFloat(result.getValue(nsIds.oppForecast_amount)) || 0;
                    });
                    log.debug({
                        title: 'Total Forecast Value',
                        details: 'Total Forecast Value: ' + totalForecastAmount
                    });
                }

                // Format the total forecast amount
                totalForecastAmount = ' ($' + Helpers.formatNumber(totalForecastAmount) + ')';

                // Update the SFA Forecast subtab title
                Helpers.updateSubtabTitle('SFA Forecast', 'totalSFAForecastAmount', totalForecastAmount);
            }

            // Sales Process and Market Sector logic
            var isFormMatch = isFormMatching(context);
            if (!isFormMatch) {
                return;
            }
            var type = context.mode;
            log.debug({
                title: 'pageInit - Sales Process',
                details: 'Mode: ' + type + ', Form Matching: ' + isFormMatch
            });

            _updateSalesProcessQuestionTotalsViaDOM(
                _calculateSalesProcessQuestionTotals(context, type)
            );

            _hideShowCompetitionOther(context);

            _updateOppForecastSubtabTitle(
                _getOppForecastSubtabTitle(context)
            );

            if (!context.currentRecord.id) {
                log.debug({
                    title: 'pageInit - Default Sales Process',
                    details: 'Setting default sales process values'
                });
                _setDefaultSalesProcessValues(context);
            }

            if (type === 'edit' || type === 'create') {
                _hideMarketSector(context);
            }
        } catch (e) {
            log.error({
                title: 'Error in pageInit',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function fieldChanged(context, linenum) {
        try {
            var isFormMatch = isFormMatching(context);
            if (!isFormMatch) {
                return;
            }
            var currentRec = context.currentRecord;
            var type = context.mode;
            var name = context.fieldId;
            var fieldValue;

            log.debug({
                title: 'fieldChanged',
                details: 'Field: ' + name + ', Mode: ' + type + ', Line: ' + linenum
            });

            _updateSalesProcessQuestionTotalsViaDOM(
                _calculateSalesProcessQuestionTotals(context, type)
            );
            _hideShowCompetitionOther(context);
            _updateOppForecastSubtabTitle(
                _getOppForecastSubtabTitle(context)
            );

            switch (name) {
                case nsIds.probability:
                    try {
                        fieldValue = currentRec.getValue({ fieldId: nsIds.probability }).replace('%', '');
                        if (fieldValue > 99.9) {
                            currentRec.setValue({ fieldId: nsIds.probability, value: 99.9 });
                        }
                    } catch (e) {
                        log.error({
                            title: 'Error in fieldChanged - Probability',
                            details: 'Error: ' + e.message + ', Stack: ' + e.stack
                        });
                    }
                    break;

                case nsIds.oppMarketType:
                    _handleMarketTypeChange(context, currentRec.getValue({ fieldId: name }));
                    break;

                case nsIds.oppMarketSectorScripted:
                    _handleMarketSectorChange(context);
                    break;

                default:
                    break;
            }
        } catch (e) {
            log.error({
                title: 'Error in fieldChanged',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function saveRecord(context) {
        try {
            var isFormMatch = isFormMatching(context);
            if (!isFormMatch) {
                return true;
            }
            _verifyCompetitionOtherField(context);
            return true;
        } catch (e) {
            dialog.alert({
                title: 'Error',
                message: e.toString()
            });
            return false;
        }
    }

    function sublistChanged(context) {
        try {
            var isFormMatch = isFormMatching(context);
            if (!isFormMatch) {
                return;
            }
            _updateOppForecastSubtabTitle(
                _getOppForecastSubtabTitle(context)
            );
        } catch (e) {
            log.error({
                title: 'Error in sublistChanged',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _handleMarketTypeChange(context, marketTypeId) {
        try {
            var rec = context.currentRecord;
            var markets = getFilteredMarkets(context, marketTypeId);
            var oppScriptedmarketSector = rec.getField({ fieldId: nsIds.oppMarketSectorScripted });

            if (oppScriptedmarketSector) {
                oppScriptedmarketSector.removeSelectOption({ value: null });
                for (var i = 0; i < markets.length; i++) {
                    var option = markets[i];
                    oppScriptedmarketSector.insertSelectOption({
                        value: option.value,
                        text: option.text,
                        isSelected: false
                    });
                }
            }
        } catch (e) {
            log.error({
                title: 'Error in handleMarketTypeChange',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _updateSalesProcessQuestionTotalsViaDOM(salesProcesses) {
        try {
            log.debug({
                title: 'updateSalesProcessQuestionTotalsViaDOM',
                details: 'Sales Processes: ' + JSON.stringify(salesProcesses)
            });
            var salesProcessCount = 0;
            var salesProcessTotal = 0;

            salesProcesses.forEach(function(e) {
                var sectionId = 'total' + e.name;
                sectionId = sectionId.replace(/ /g, '_').replace(/&/g, '_');
                salesProcessCount += e.totalFilledOut;
                salesProcessTotal += e.total;

                if (jQuery('#' + sectionId).length === 0) {
                    jQuery("div.fgroup_title:contains('" + e.name + "')").append(
                        jQuery('<span>', {
                            id: sectionId,
                            html: " (" + e.totalFilledOut + '/' + e.total + ")"
                        })
                    );
                } else {
                    jQuery('#' + sectionId).html(" (" + e.totalFilledOut + '/' + e.total + ")");
                }
            });

            Helpers.updateSubtabTitle('Sales Process', 'totalSalesProcess', ' (' + salesProcessCount + '/' + salesProcessTotal + ')');
        } catch (e) {
            log.error({
                title: 'Error in updateSalesProcessQuestionTotalsViaDOM',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _calculateSalesProcessQuestionTotals(context, type) {
        try {
            var rec = context.currentRecord;
            var salesProcesses = [
                {
                    name: 'Qualification',
                    totalFilledOut: 0,
                    total: 0,
                    fields: [
                        'custbody_problem_definition',
                        'custbody_opportunity_potential',
                        'custbody_available_budget',
                        'custbody_annual_budget_amount',
                        'custbody_primary_contact',
                        'custbody_primary_contract_role'
                    ]
                },
                {
                    name: 'Project Scope',
                    totalFilledOut: 0,
                    total: 0,
                    fields: [
                        'custbody_application_type',
                        'custbody_site_capacity',
                        'custbody_collector_substation',
                        'custbody_population_size_miles',
                        'custbody_avg_cable_length',
                        'custbody_voltage_class',
                        'custbody_line_to_ground',
                        'custbody_cable_insulation_type',
                        'custbody_cable_shield_type',
                        'custbody_install_type',
                        'custbody_cable_conductor_type'
                    ]
                },
                {
                    name: 'Client Education',
                    totalFilledOut: 0,
                    total: 0,
                    fields: [
                        'custbody_apc',
                        'custbody_webinar',
                        'custbody_kickoff_meeting',
                        'custbody_financial_roi',
                        'custbody_capx_ferc',
                        'custbody_operational_best_practices',
                        'custbody_camera',
                        'custbody_how_cables_fail'
                    ]
                },
                {
                    name: 'Key Stakeholders',
                    totalFilledOut: 0,
                    total: 0,
                    fields: [
                        'custbody_project_sponsor',
                        'custbody_decision_maker',
                        'custbody_budget_controller',
                        'custbody_operations',
                        'custbody_asset_management',
                        'custbody_accounting',
                        'custbody_standards_engineering',
                        'custbody_public_affairs',
                        'custbody_contract_governance'
                    ]
                },
                {
                    name: 'System Operation',
                    totalFilledOut: 0,
                    total: 0,
                    fields: [
                        'custbody_termination_repair_cost',
                        'custbody_system_configuration',
                        'custbody_current_strategy',
                        'custbody_primary_reliability_metric',
                        'custbody_reliability_metric_perf',
                        'custbody_cable_failure_rate',
                        'custbody_repairs_made',
                        'custbody_can_testing_be_capx',
                        'custbody_assist_crew_cost',
                        'custbody_cable_replacement_cost',
                        'custbody_3_phase_replacement_cost',
                        'custbody_midspan_repair_cost'
                    ]
                },
                {
                    name: 'Proposal & Negotiation',
                    totalFilledOut: 0,
                    total: 0,
                    fields: [
                        'custbody_desired_start_date',
                        'custbody_imcorp_spec',
                        'custbody_imcorp_sole_sourced',
                        'custbody_guarantee_type',
                        'custbody_competition',
                        'custbody_competition_other',
                        'winlossreason',
                        'custbody_lost_reason_descr',
                        'custbody_future_opp'
                    ]
                }
            ];

            salesProcesses.forEach(function(e) {
                e.fields.forEach(function(fieldName) {
                    if (rec.getField(fieldName)) {
                        var fieldType = rec.getField(fieldName).type;
                        switch (fieldType) {
                            case 'checkbox':
                                if (!rec.getField(fieldName).isHidden) {
                                    e.totalFilledOut += (rec.getValue(fieldName) === 'T') ? 1 : 0;
                                    e.total++;
                                }
                                break;
                            default:
                                if (fieldName === 'custbody_competition_other') {
                                    if (parseInt(rec.getValue(nsIds.oppCompetition)) === nsVals.competition.other) {
                                        e.totalFilledOut += (rec.getValue(fieldName)) ? 1 : 0;
                                        e.total++;
                                    }
                                } else {
                                    if (!rec.getField(fieldName).isHidden) {
                                        e.totalFilledOut += (rec.getValue(fieldName)) ? 1 : 0;
                                        e.total++;
                                    }
                                }
                                break;
                        }
                    }
                });
            });

            return salesProcesses;
        } catch (e) {
            log.error({
                title: 'Error in calculateSalesProcessQuestionTotals',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
            return [];
        }
    }

    function _hideShowCompetitionOther(context) {
        try {
            var rec = context.currentRecord;
            var competition = rec.getValue(nsIds.oppCompetition);
            var labelId = 'mandatory_' + nsIds.oppCompetitionOther;

            if (jQuery('#' + labelId).length > 0) {
                jQuery('#' + labelId).remove();
            }

            if (parseInt(competition) === nsVals.competition.other) {
                jQuery('#' + nsIds.oppCompetitionOther).closest('tr').show();
                jQuery('#' + nsIds.oppCompetitionOther + '_fs_lbl').prepend(
                    jQuery('<label>', {
                        id: labelId,
                        class: 'uir-required-icon',
                        html: '*'
                    })
                );
            } else {
                jQuery('#' + nsIds.oppCompetitionOther).closest('tr').hide();
            }
        } catch (e) {
            log.error({
                title: 'Error in hideShowCompetitionOther',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _getOppForecastSubtabTitle(context) {
        try {
            if (context.currentRecord.id) {
                var filters = [];
                filters.push(search.createFilter({
                    name: nsIds.oppForecast_relatedOpp,
                    operator: search.Operator.IS,
                    values: [context.currentRecord.id]
                }));

                var columns = [];
                var amount = search.createColumn({
                    name: nsIds.oppForecast_amount
                });
                columns.push(amount);

                var searchResult = search.create({
                    type: nsIds.oppForecast,
                    filters: filters,
                    columns: columns
                }).run().getRange({ start: 0, end: 1000 }) || [];

                var totalAmount = 0;
                for (var i = 0; i < searchResult.length; i++) {
                    var f = searchResult[i];
                    totalAmount += parseFloat(f.getValue(amount));
                }

                var projectedTotal = context.currentRecord.getValue(nsIds.oppProjectedTotal) || '0';

                return ' ($' + Helpers.formatNumber(totalAmount) + ' / $' + Helpers.formatNumber(projectedTotal) + ')';
            }
            return '';
        } catch (e) {
            log.error({
                title: 'Error in getOppForecastSubtabTitle',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
            return '';
        }
    }

    function _updateOppForecastSubtabTitle(amount) {
        try {
            Helpers.updateSubtabTitle('Forecast', 'totalForecastAmount', amount);
        } catch (e) {
            log.error({
                title: 'Error in updateOppForecastSubtabTitle',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _setDefaultSalesProcessValues(context) {
        try {
            var currentRec = context.currentRecord;
            var customForm = parseInt(currentRec.getValue('customform'));

            switch (customForm) {
                case nsVals.opportunityTemplates.renewable:
                    log.debug({
                        title: 'setDefaultSalesProcessValues',
                        details: 'Setting default values for form: ' + customForm
                    });
                    currentRec.setValue({
                        fieldId: nsIds.oppSalesProcess_VoltageClass,
                        value: nsVals.voltageClasses.class35kv
                    });
                    currentRec.setValue({
                        fieldId: nsIds.oppSalesProcess_LineToGroundVoltage,
                        value: '19.9'
                    });
                    currentRec.setValue({
                        fieldId: nsIds.oppSalesProcess_InstallType,
                        value: nsVals.installTypes.directBuried
                    });
                    currentRec.setValue({
                        fieldId: nsIds.oppSalesProcess_CableInsulationType,
                        value: nsVals.insulationTypes.trxlpe
                    });
                    currentRec.setValue({
                        fieldId: nsIds.oppSalesProcess_CableShieldType,
                        value: nsVals.shieldTypes.concentric
                    });
                    currentRec.setValue({
                        fieldId: nsIds.oppSalesProcess_CableConductorType,
                        value: nsVals.conductorTypes.strand
                    });
                    break;
                default:
                    break;
            }
        } catch (e) {
            log.error({
                title: 'Error in setDefaultSalesProcessValues',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _hideMarketSector(context) {
        try {
            log.debug({
                title: 'hideMarketSector',
                details: 'Hiding market sector field'
            });
            jQuery('#' + nsIds.oppMarketSector).closest('tr').hide();
        } catch (e) {
            log.error({
                title: 'Error in hideMarketSector',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _handleMarketSectorChange(context) {
        try {
            var rec = context.currentRecord;
            var marketSectorId = rec.getValue({ fieldId: nsIds.oppMarketSectorScripted });
            rec.setValue({ fieldId: nsIds.oppMarketSector, value: marketSectorId });
        } catch (e) {
            log.error({
                title: 'Error in handleMarketSectorChange',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
        }
    }

    function _verifyCompetitionOtherField(context) {
        try {
            var rec = context.currentRecord;
            var competition = rec.getValue({ fieldId: nsIds.oppCompetition });
            var competitionOther = rec.getValue({ fieldId: nsIds.oppCompetitionOther });

            if (parseInt(competition) === nsVals.competition.other) {
                if (competitionOther.length < 3) {
                    throw new Error('If "Other" is selected for Competition, then at least three characters must be written in the "Other Competition" field.');
                }
            }
        } catch (e) {
            log.error({
                title: 'Error in verifyCompetitionOtherField',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
            throw e;
        }
    }

    function isFormMatching(context) {
        try {
            var script = runtime.getCurrentScript();
            var formParameterId = script.getParameter({ name: 'custscript_opp_forms' });

            if (formParameterId && formParameterId.trim() !== '') {
                var forms = formParameterId.split(',');
                var rec = context.currentRecord;
                var currentFormId = rec.getValue({ fieldId: 'customform' });
                return forms.indexOf(currentFormId) >= 0;
            }
            return false;
        } catch (e) {
            log.error({
                title: 'Error in isFormMatching',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
            return false;
        }
    }

    function getFilteredMarkets(context, marketTypeId) {
        try {
            if (!marketTypeId) {
                return [];
            }

            var marketRec = record.load({
                type: 'customrecord_market_sector',
                id: marketTypeId
            });

            var marketId = marketRec.getValue('custrecord_child_market_type');

            var filters = [
                search.createFilter({
                    name: 'custrecord_child_market_type',
                    operator: search.Operator.ANYOF,
                    values: '@NONE@'
                }),
                search.createFilter({
                    name: 'custrecord_parent_market_types',
                    operator: search.Operator.ANYOF,
                    values: [marketId]
                })
            ];

            var columns = [
                search.createColumn({ name: 'internalid' }),
                search.createColumn({ name: 'name' })
            ];

            var searchResult = search.create({
                type: 'customrecord_market_sector',
                filters: filters,
                columns: columns
            }).run().getRange({ start: 0, end: 1000 }) || [];

            var results = [{ value: '', text: '' }];
            searchResult.forEach(function(result) {
                var value = result.getValue(columns[0]);
                var text = result.getValue(columns[1]);
                results.push({ value: value, text: text });
            });

            return results;
        } catch (e) {
            log.error({
                title: 'Error in getFilteredMarkets',
                details: 'Error: ' + e.message + ', Stack: ' + e.stack
            });
            return [];
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord,
        sublistChanged: sublistChanged
    };
});