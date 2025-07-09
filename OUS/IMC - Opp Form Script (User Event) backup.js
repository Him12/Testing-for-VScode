/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 *
 * Version History:
 *
 * | Version | Date       | Author               | Remarks                                                           |
 * |---------|------------|----------------------|-------------------------------------------------------------------|
 * | 1.00    | 13/01/2025 | Yogesh P Bhurley     | Code added by Yogesh Bhurley 13/01/2025 to show forecast details  |
 */

define(['N/record', 'N/log', 'N/runtime', 'N/search'], function(record, log, runtime, search) {

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
      
        soContractStatus: 'custbody_contract_status', //iid: 202
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
        //quoteCOStatus: 'custbody_co_status',
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
        OkStatus: 2, //Completed w/ Approval document
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
          standbyWeather: 37,
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
          renewable: 138
        },
        voltageClasses: {
          'class35kv': 4
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
          unitedStates: 230,
        }
      };
  
   function beforeLoad(context) {
    var type = context.type;
    var form = context.form;
    var newRecord = context.newRecord;
	
	var boolean = isFormMatching(context);
	if(boolean == 0){
		return;
	}

    // Logging the context type for debugging
    log.debug('Context Type', type);

    // Handling VIEW type
    if (type === context.UserEventType.VIEW) {
        log.debug('Entering VIEW context');

        var salesProcesses = _calculateSalesProcessQuestionTotals(context);
        var oppTotals = _getOppForecastSubtabTitle(context);
        
        log.debug('Sales Processes', salesProcesses);
        log.debug('Opportunity Totals', oppTotals);

        var scriptText = '<scr' + 'ipt>' +
    'var _salesProcesses = JSON.parse(\'' + JSON.stringify(salesProcesses).replace(/'/g, "\\'") + '\');' +
    'var Helpers = {};' +
    'Helpers.formatNumber = ' + String(Helpers.formatNumber) + ';' +
    'Helpers.updateSubtabTitle = ' + String(Helpers.updateSubtabTitle) + ';' +
    'var _updateOppForecastSubtabTitle = ' + String(_updateOppForecastSubtabTitle) + ';' +
    'var _updateSalesProcessQuestionTotalsViaDOM = ' + String(_updateSalesProcessQuestionTotalsViaDOM) + ';' +
    'jQuery(document).ready(function() {' +
    '_updateSalesProcessQuestionTotalsViaDOM(_salesProcesses);' +
    '_updateOppForecastSubtabTitle(\'' + oppTotals.replace(/'/g, "\\'") + '\');' +
    '});' +
    '</scr' + 'ipt>';


       
       var field = form.getField(nsIds.viewModeScriptField);
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
    }
    // Handling EDIT and CREATE types
    else if (type === context.UserEventType.EDIT || type === context.UserEventType.CREATE) {
        log.debug('Entering EDIT/CREATE context');

        var marketSectorField = form.getField(nsIds.oppMarketSector);
        var marketSectorId = newRecord.getValue(nsIds.oppMarketSector);
        var marketTypeId = newRecord.getValue(nsIds.oppMarketType);

        var customSelectField = form.addField({
            id: nsIds.oppMarketSectorScripted,
            type: 'select',
            label: 'Market Sector'
        });
        customSelectField.helpText = 'The selections here are based off of the selected Market Type.';
        customSelectField.isMandatory = true;

        // Hiding the existing Market Sector field
        marketSectorField.updateDisplayType({
            displayType: 'hidden'
        });

        // Get filtered markets based on market type
        var filteredMarkets = getFilteredMarkets(marketTypeId);
        for (var i = 0; i < filteredMarkets.length; i++) {
            var option = filteredMarkets[i];
            customSelectField.addSelectOption({
                value: option.value,
                text: option.text,
                isSelected: option.value == marketSectorId
            });
        }
    }
}

    function beforeSubmit(context) {
        var type = context.type;

        var boolean = isFormMatching(context);
        if(boolean == 0){
            return;
        }

        if (context.newRecord.id) {
            var oldRecord = record.load({
                type: 'opportunity',
                id: context.newRecord.id
            });
            context.newRecord.setValue({
                fieldId: nsIds.previousExpectedStartDate,
                value: oldRecord.getValue(nsIds.expectedStartDate)
            });
        }

        //if (type.toString() === 'delete') {
      if (context.type == context.UserEventType.DELETE){
            _deleteOrphanedOppForecasts(context.newRecord.id);
        } else {
            updateFieldForScheduler(context);
        }

        //if (type.toString() === 'xedit') {
          if (context.type == context.UserEventType.XEDIT){
            _updateOpportunityMarketType_MASSUPDATE(context);
        } else {
            _updateSalesProcessQuestionTotalFields(context,type);
        }
    }

    function afterSubmit(context) {
        var recordId = context.newRecord.id;

        var boolean = isFormMatching(context);
        if(boolean == 0){
            return;
        }

        if (context.newRecord.getValue('entitystatus') == nsVals.customerStatus.closedLost) {
            _deleteOppForecastsForLostOpportunity(recordId);
        }

        updateStartDates('opportunity', recordId, context.newRecord.getValue(nsIds.expectedStartDate));
    }

  var Helpers = (function () {
  
    function _updateSubtabTitle (subtabTitle, newTitleId, newTitle) {
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

  function _updateOppForecastSubtabTitle(amount) {
        Helpers.updateSubtabTitle('Forecast', 'totalForecastAmount', amount);
    }

    function _calculateSalesProcessQuestionTotals(context,type) {
        var record = context.newRecord;
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

        // Iterate through each sales process and calculate the totals for filled out fields

        salesProcesses.forEach(function(e, i) {
            var j = 0;
            e.fields.forEach(function(fieldName) {
           // console.log(fieldName);
              if (record.getField(fieldName)) {
                var fieldType = record.getField(fieldName).type;
                //console.log(fieldType)
                switch (fieldType) {
                  case "checkbox":
                    var fieldObj = record.getField(fieldName)
                    if (!record.getField(fieldName).hidden) {
                      e.totalFilledOut += (record.getValue(fieldName) == 'T') ? 1 : 0;
                      e.total++;
                    }
                    break;
                  default:
                    if (fieldName == 'custbody_competition_other') {
                      if (+record.getValue(nsIds.oppCompetition) === nsVals.competition.other) {
                        e.totalFilledOut += (record.getValue(fieldName)) ? 1 : 0;
                        e.total++;
                      }
                    } else {
                      if (!record.getField(fieldName).hidden) {
                        //console.log(fieldName);
                        e.totalFilledOut += (record.getValue(fieldName)) ? 1 : 0;
                        e.total++;
                      }
                    }
                    break;
                }
              } else {
                //console.log('There is a problem with the field: ' + fieldName);
              }
            });
          });

        return salesProcesses;
    }

    function _getOppForecastSubtabTitle(context) {
        if (context.newRecord.id) {
            var filters = [];
            filters.push(search.createFilter({
                name: nsIds.oppForecast_relatedOpp,
                operator: search.Operator.IS,
                values: [context.newRecord.id]
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
    
            var projectedTotal = context.newRecord.getValue(nsIds.oppProjectedTotal) || '0';
    
            return ' ($' + Helpers.formatNumber(totalAmount) + ' / $' + Helpers.formatNumber(projectedTotal) + ')';
        }
    
        return '';
    } 

    function _updateOppForecastSubtabTitle(amount) {
        Helpers.updateSubtabTitle('Forecast', 'totalForecastAmount', amount);
    }

    function _updateSalesProcessQuestionTotalsViaDOM(salesProcesses) {
       // console.log('salesProcesses == '+JSON.stringify(salesProcesses));
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
    }

    function getFilteredMarkets(marketTypeId) {
        if (!marketTypeId) { return []; }

        // Load the custom record for the given market type ID
        var marketRecord = record.load({
            type: 'customrecord_market_sector',
            id: marketTypeId
        });
        
        var marketId = marketRecord.getValue('custrecord_child_market_type');

        // Define filters for the search
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

        // Define columns for the search
        var columns = [
            search.createColumn({ name: 'internalid' }),
            search.createColumn({ name: 'name' })
        ];

        // Perform the search
        var searchResult = search.create({
            type: 'customrecord_market_sector',
            filters: filters,
            columns: columns
        }).run().getRange({ start: 0, end: 1000 }) || [];

        // Process search results
        var results = [{ value: '', text: '' }];
        searchResult.forEach(function(result) {
            var value = result.getValue(columns[0]);
            var text = result.getValue(columns[1]);

            results.push({ value: value, text: text });
        });

        return results;
    }

    function _updateOpportunityMarketType_MASSUPDATE(context) {
        // Load the 'opportunity' record
        var opportunityRecord = record.load({
            type: 'opportunity',
            id: context.newRecord.id
        });

        var owner = opportunityRecord.getValue('custbody_owner_name');

        // Update 'custbody_owner_name' based on the existing owner or entity
        if (owner) {
            opportunityRecord.setValue({
                fieldId: 'custbody_owner_name',
                value: owner
            });
        } else {
            opportunityRecord.setValue({
                fieldId: 'custbody_owner_name',
                value: opportunityRecord.getValue('entity')
            });
        }

        // Submit the updated record
        opportunityRecord.save({
            enableSourcing: false,
            ignoreMandatoryFields: true
        });
    }

    function _updateSalesProcessQuestionTotalFields(context,type) {
        var numerator = 0;
        var denominator = 0;
        var total;
        var record = context.newRecord;

        // Calculate totals
        _calculateSalesProcessQuestionTotals(context,type).forEach(function(salesProcess) {
            numerator += salesProcess.totalFilledOut;
            denominator += salesProcess.total;

            var percent = 100 * ((salesProcess.total > 0) ? (salesProcess.totalFilledOut / salesProcess.total) : 0);

            switch (salesProcess.name) {
                case 'Qualification':
                    record.setValue({
                        fieldId: nsIds.oppSalesProcess_QualificationPercent,
                        value: percent
                    });
                    break;
                case 'Project Scope':
                    record.setValue({
                        fieldId: nsIds.oppSalesProcess_ProjectScopePercent,
                        value: percent
                    });
                    break;
                case 'Client Education':
                    record.setValue({
                        fieldId: nsIds.oppSalesProcess_ClientEducationPercent,
                        value: percent
                    });
                    break;
                case 'Key Stakeholders':
                    record.setValue({
                        fieldId: nsIds.oppSalesProcess_KeyStakeholdersPercent,
                        value: percent
                    });
                    break;
                case 'System Operation':
                    record.setValue({
                        fieldId: nsIds.oppSalesProcess_SystemOperationPercent,
                        value: percent
                    });
                    break;
                case 'Proposal & Negotiation':
                    record.setValue({
                        fieldId: nsIds.oppSalesProcess_PropNegotPercent,
                        value: percent
                    });
                    break;
                default:
                    break;
            }
        });

        total = (denominator > 0) ? (100 * numerator / denominator) : 0;

        record.setValue({
            fieldId: nsIds.oppSalesProcess_TotalPercent,
            value: total
        });
    }

    function _deleteOrphanedOppForecasts(recordId) {
        // Define filters for the search
        var filters = [
            search.createFilter({
                name: nsIds.oppForecast_relatedOpp,
                operator: search.Operator.IS,
                values: recordId
            })
        ];

        // Define columns for the search
        var columns = [
            search.createColumn({ name: 'internalid' }),
            search.createColumn({ name: nsIds.oppForecast_amount }),
            search.createColumn({ name: nsIds.oppForecast_date })
        ];

        // Execute the search
        var searchResult = search.create({
            type: nsIds.oppForecast,
            filters: filters,
            columns: columns
        }).run().getRange({ start: 0, end: 1000 }) || [];

        // Process search results and delete records
        searchResult.forEach(function(result) {
            var internalId = result.getValue('internalid');
            var amount = result.getValue(nsIds.oppForecast_amount);
            var forecastDate = result.getValue(nsIds.oppForecast_date);

            // Log the deletion of orphaned forecasts
            log.audit('Delete orphan Opportunity Forecasts', 
                'For Opportunity ID ' + recordId + 
                ', delete Opp. Forecast (ID: ' + internalId + 
                ', Date: ' + forecastDate + 
                ', Amount: ' + amount + ')');

            // Delete the record
            record.delete({
                type: nsIds.oppForecast,
                id: internalId
            });
        });
    }

    function updateFieldForScheduler(context) {
        var record = context.newRecord;

        // Get the new state value from the 'custbody_project_state' field
        var newState = record.getValue({
            fieldId: nsIds.projectState
        });

        // Set the job site state to the old state ID
        record.setValue({
            fieldId: nsIds.jobSiteState,
            value: getOldStateId(newState)
        });
    }
    function getOldStateId (newState) {
    switch (newState) {
      case '0':
        return  '1';
      case '1':
        return  '2';
      case '2':
        return  '3';
      case '3':
        return  '4';
      case '4':
        return  '5';
      case '5':
        return  '6';
      case '6':
        return  '7';
      case '7':
        return  '8';
      case '9':
        return  '9';
      case '10':
        return '10';
      case '11':
        return '11';
      case '12':
        return '12';
      case '13':
        return '13';
      case '14':
        return '14';
      case '15':
        return '15';
      case '16':
        return '16';
      case '17':
        return '17';
      case '18':
        return '18';
      case '19':
        return '19';
      case '20':
        return '20';
      case '21':
        return '21';
      case '22':
        return '22';
      case '23':
        return '23';
      case '24':
        return '24';
      case '25':
        return '25';
      case '26':
        return '26';
      case '27':
        return '27';
      case '28':
        return '28';
      case '29':
        return '29';
      case '30':
        return '30';
      case '31':
        return '31';
      case '32':
        return '32';
      case '33':
        return '33';
      case '34':
        return '34';
      case '35':
        return '35';
      case '36':
        return '36';
      case '37':
        return '37';
      case '38':
        return '38';
      case '40':
        return '39';
      case '41':
        return '40';
      case '42':
        return '41';
      case '43':
        return '42';
      case '44':
        return '43';
      case '45':
        return '44';
      case '46':
        return '45';
      case '47':
        return '46';
      case '48':
        return '47';
      case '50':
        return '59';
      case '49':
        return '48';
      case '51':
        return '60';
      case '101':
        return '50';
      case '102':
        return '51';
      case '103':
        return '52';
      case '104':
        return '53';
      case '105':
        return '54';
      case '106':
        return '55';
      case '109':
        return '56';
      case '111':
        return '57';
      case '112':
        return '58';
      case '39':
        return '64';
      case '506':
        return '67';
      case '518':
        return '68';
      case '502':
        return '69';
      case '510':
        return '70';
      case '527':
        return '71';
      default:
        return '72';
    }
  }

    function _deleteOppForecastsForLostOpportunity(recordId) {
        if (recordId !== '') {
            // Define filters for the search
            var filters = [
                search.createFilter({
                    name: nsIds.oppForecast_relatedOpp,
                    operator: search.Operator.IS,
                    values: recordId
                })
            ];

            // Define columns for the search
            var columns = [
                search.createColumn({ name: 'internalid' }),
                search.createColumn({ name: nsIds.oppForecast_amount }),
                search.createColumn({ name: nsIds.oppForecast_date })
            ];

            // Execute the search
            var searchResult = search.create({
                type: nsIds.oppForecast,
                filters: filters,
                columns: columns
            }).run().getRange({ start: 0, end: 1000 }) || [];

            // Process search results and delete records
            searchResult.forEach(function(result) {
                var internalId = result.getValue({ name: 'internalid' });
                var amount = result.getValue({ name: nsIds.oppForecast_amount });
                var forecastDate = result.getValue({ name: nsIds.oppForecast_date });

                // Log the deletion of opportunity forecasts
                log.audit('Delete Opportunity Forecasts for "Closed Lost" Opportunity', 
                    'For Opportunity ID ' + recordId + 
                    ', delete Opp. Forecast (ID: ' + internalId + 
                    ', Date: ' + forecastDate + 
                    ', Amount: ' + amount + ')');

                // Delete the record
                record.delete({
                    type: nsIds.oppForecast,
                    id: internalId
                });
            });
        }
    }

   

    function isFormMatching(context) {
		try{
			var bool = 0;
			var script = runtime.getCurrentScript();

			var formParameterId = script.getParameter({ name: 'custscript_opp_form2' });
			var forms = formParameterId.split(',').map(Number);

			var rec = context.newRecord;

		   /** Code added by Yogesh Bhurley 13/01/2025 **/

			if(context.newRecord.id){

				let transactionSearchObj = 	search.create({
											    type: "transaction",
											    settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
											    filters:
											    [
												  ["type","anyof","Opprtnty"], 
												  "AND", 
												  ["customform","anyof",forms],
												  "AND", 
												  ["internalid","anyof",context.newRecord.id]
											   ],
											   columns:
											   [
												  search.createColumn({name: "customform", label: "Custom Form"})
											   ]
											});

										

										

				let resultRange = transactionSearchObj.run().getRange(0,1);

			  

				if(resultRange.length>0){
					bool = 1;
				}else{
					bool = 0;
				}
			}
			return bool;
			/** Code updation Finished **/
		}
		catch(e){
			log.error("Error In isFormMatching function",e.message)
		}        
    }

    function updateStartDates(tranName, tranId) {
        var foundTransactions = [];
        var oldDate, newDate;

        if (!tranId) return;

        switch (tranName) {
            case 'opportunity':
                try {
                    var opportunityRecord = record.load({
                        type: 'opportunity',
                        id: tranId
                    });
                    oldDate = opportunityRecord.getValue({ fieldId: nsIds.previousExpectedStartDate });
                    newDate = opportunityRecord.getValue({ fieldId: nsIds.expectedStartDate });
                } catch (e) {}
                break;
            case 'estimate':
                try {
                    var estimateRecord = record.load({
                        type: 'estimate',
                        id: tranId
                    });
                    oldDate = estimateRecord.getValue({ fieldId: nsIds.previousExpectedStartDate });
                    newDate = estimateRecord.getValue({ fieldId: nsIds.expectedStartDate });
                } catch (e) {}
                break;
            case 'salesOrder':
                try {
                    var salesOrderRecord = record.load({
                        type: 'salesOrder',
                        id: tranId
                    });
                    oldDate = salesOrderRecord.getValue({ fieldId: nsIds.previousExpectedStartDate });
                    newDate = salesOrderRecord.getValue({ fieldId: 'startdate' });
                    foundTransactions.push({
                        id: salesOrderRecord.getValue({ fieldId: 'createdfrom' }),
                        tranType: 'Estimate'
                    });
                } catch (e) {}
                break;
            default:
                break;
        }

        log.audit('_updateStartDates', tranName + ', ' + tranId + ': ' + JSON.stringify(oldDate) + ' === ' + JSON.stringify(newDate) + ' ? ' + JSON.stringify(oldDate === newDate));

        if (oldDate === newDate) {
            return;
        }

        if (tranName === 'opportunity') {
            var filters = [
                search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
                search.createFilter({ name: 'opportunity', operator: search.Operator.IS, values: tranId })
            ];

            var searchResult = search.create({
                type: 'transaction',
                filters: filters,
                columns: ['internalid', 'type']
            }).run().getRange({ start: 0, end: 1000 }) || [];

            searchResult.forEach(function(result) {
                foundTransactions.push({
                    id: result.getValue({ name: 'internalid' }),
                    tranType: result.getValue({ name: 'type' })
                });
            });
        } else {
            var oppId = record.getFieldValue({ fieldId: 'opportunity' }); // Use the correct way to get the field value
            if (oppId) {
                foundTransactions.push({
                    id: oppId,
                    tranType: 'Opportunity'
                });
            }

            if (tranName === 'estimate') {
                var filters = [
                    search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
                    search.createFilter({ name: 'type', operator: search.Operator.IS, values: 'SalesOrd' }),
                    search.createFilter({ name: 'createdFrom', operator: search.Operator.IS, values: tranId })
                ];

                var searchResult = search.create({
                    type: 'transaction',
                    filters: filters,
                    columns: ['internalid', 'type']
                }).run().getRange({ start: 0, end: 1000 }) || [];

                searchResult.forEach(function(result) {
                    foundTransactions.push({
                        id: result.getValue({ name: 'internalid' }),
                        tranType: result.getValue({ name: 'type' })
                    });
                });
            }
        }

        foundTransactions.forEach(function(tran) {
            if (tran.id) {
				try{
                var recordToUpdate;
                switch (tran.tranType) {
                    case 'Opportunity':
                        recordToUpdate = record.load({ type: 'opportunity', id: tran.id });
                        recordToUpdate.setValue({ fieldId: nsIds.expectedStartDate, value: newDate });
                        recordToUpdate.save({ignoreMandatoryFields: true});;
                        break;
                    case 'Estimate':
                        recordToUpdate = record.load({ type: 'estimate', id: tran.id });
                        recordToUpdate.setValue({ fieldId: nsIds.expectedStartDate, value: newDate });
                        recordToUpdate.save({ignoreMandatoryFields: true});
                        break;
                    case 'SalesOrd':
                        recordToUpdate = record.load({ type: 'salesOrder', id: tran.id });
                        recordToUpdate.setValue({ fieldId: nsIds.expectedStartDate, value: newDate });
                        recordToUpdate.setValue({ fieldId: 'startdate', value: newDate });
                        recordToUpdate.save({ignoreMandatoryFields: true});
                        break;
                    default:
                        break;
                 }
				}catch(e){
					log.debug('Error',e.msg);
				}
            }
        });
    }
    
    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});