/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/dialog','N/runtime','N/currentRecord','N/record','N/search','N/ui/message'], function(dialog,runtime,currentRecord,record,search,message) {

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
          renewable: 230
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

    function _client_pageInit(context) {
        //alert('pageinit triggered');

        var boolean = isFormMatching(context);
        if(boolean == 0){
            return;
        }
        var type = context.mode;
        _updateSalesProcessQuestionTotalsViaDOM(
            _calculateSalesProcessQuestionTotals(context,type)
        );

        _hideShowCompetitionOther(context);

        _updateOppForecastSubtabTitle(
            _getOppForecastSubtabTitle(context)
        );

        if (!context.currentRecord.id) {
            console.log('default sales process function called');
            _setDefaultSalesProcessValues(context);
        }

        if (type === 'edit' || type === 'create') {
            _hideMarketSector(context);
        }
    }

    function _client_fieldChanged(context,linenum) {

        var boolean = isFormMatching(context);
        if(boolean == 0){
            return;
        }
        var currentRecord = context.currentRecord;
        var type = context.mode;
        var name = context.fieldId;
        var fieldValue;

        _updateSalesProcessQuestionTotalsViaDOM(
            _calculateSalesProcessQuestionTotals(context,type)
        );
        _hideShowCompetitionOther(context);
        _updateOppForecastSubtabTitle(
            _getOppForecastSubtabTitle(context)
        );

        switch (name) {
            case nsIds.probability:
				try{
					fieldValue = currentRecord.getValue({ fieldId: nsIds.probability }).replace('%', '');
					if (fieldValue > 99.9) {
						currentRecord.setValue({ fieldId: nsIds.probability, value: 99.9 });
					}
				}
				catch(e){
					console.log("Error while replace probability",e.message)
				}

                break;

            case nsIds.oppMarketType:
                _handleMarketTypeChange(context,currentRecord.getValue({ fieldId: name }));
                break;

            case nsIds.oppMarketSectorScripted:
                _handleMarketSectorChange(context);
                break;

            default:
                break;
        }
    }

    function _client_recalc(context) {

        var boolean = isFormMatching(context);
        if(boolean == 0){
            return;
        }
        _updateOppForecastSubtabTitle(
            _getOppForecastSubtabTitle(context)
        );
    }

    function _client_saveRecord(context) {
        try {

            var boolean = isFormMatching(context);
        if(boolean == 0){
            return true;
        }
            _verifyCompetitionOtherField(context);
        } catch (e) {
            alert(e.toString());
            return false;
        }
        return true;
    }

    function _handleMarketTypeChange(context,marketTypeId) {
        var record = context.currentRecord;
        var markets = getFilteredMarkets(context,marketTypeId); // Assuming Helpers is already defined elsewhere

        var oppScriptedmarketSector = record.getField({ fieldId: nsIds.oppMarketSectorScripted });
		
		if(oppScriptedmarketSector){
			// Remove all options from the select field
			oppScriptedmarketSector.removeSelectOption({
				fieldId: nsIds.oppMarketSectorScripted, // Replace with the actual field ID
				value: null
			});

			// Loop through markets and add new options to the select field
			for (var i = 0; i < markets.length; i++) {
				var option = markets[i];

				oppScriptedmarketSector.insertSelectOption({
					fieldId: nsIds.oppMarketSectorScripted, // Replace with the actual field ID
					value: option.value,
					text: option.text,
					isSelected: false
				});
			}
		}
        
    }

    function _updateSalesProcessQuestionTotalsViaDOM(salesProcesses) {
        console.log('salesProcesses == '+JSON.stringify(salesProcesses));
        var salesProcessCount = 0;
        var salesProcessTotal = 0;

        // Iterate over each sales process
        salesProcesses.forEach(function(e) {
            var sectionId = 'total' + e.name;

            // Replace spaces and ampersands in section names
            sectionId = sectionId.replace(/ /g, '_').replace(/&/g, '_');

            // Sum the total fields filled out and total number of fields
            salesProcessCount += e.totalFilledOut;
            salesProcessTotal += e.total;

            // If the section doesn't exist, append it. Otherwise, update the existing section.
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

        // Update the sales process subtab title
        updateSubtabTitle('Sales Process', 'totalSalesProcess', ' (' + salesProcessCount + '/' + salesProcessTotal + ')');
    }

    function _calculateSalesProcessQuestionTotals(context,type) {
        var record = context.currentRecord;
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
              //  console.log(fieldType)
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

          console.log('salesProcesses = '+salesProcesses);

        return salesProcesses;
    }

    function _hideShowCompetitionOther(context) {
        var record = context.currentRecord;
        var competition = record.getValue(nsIds.oppCompetition);
       // console.log('competition == '+competition);
        var labelId = 'mandatory_' + nsIds.oppCompetitionOther;

        if (jQuery('#' + labelId).length > 0) {
            jQuery('#' + labelId).remove();
        }

        if (+competition === nsVals.competition.other) {
            /*record.getField({
                fieldId: nsIds.oppCompetitionOther
            }).updateDisplayType({
                displayType: 'entry'
            });*/
            jQuery('#' + nsIds.oppCompetitionOther).closest('tr').show();

            jQuery('#' + nsIds.oppCompetitionOther + '_fs_lbl').prepend(
                jQuery("<label>", {
                    id: labelId,
                    class: "uir-required-icon",
                    html: '*'
                })
            );
        } else {
            //console.log('else triggered to hide the competition other')
            jQuery('#' + nsIds.oppCompetitionOther).closest('tr').hide();
            /*record.getField({
                fieldId: nsIds.oppCompetitionOther
            }).updateDisplayType({
                displayType: 'hidden'
            });*/
        }
    }

    function _getOppForecastSubtabTitle(context) {
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
    
            return ' ($' + formatNumber(totalAmount) + ' / $' + formatNumber(projectedTotal) + ')';
        }
    
        return '';
    }    

    function _updateOppForecastSubtabTitle(amount) {
        updateSubtabTitle('Forecast', 'totalForecastAmount', amount);
    }
    function _setDefaultSalesProcessValues(context) {
       // console.log('default sales process function called');
        var currentRecord = context.currentRecord;
        var customForm = parseInt(currentRecord.getValue('customform'));
       // console.log('customForm=='+customForm)
    
        switch (customForm) {
            case nsVals.opportunityTemplates.renewable:
                console.log('form value = '+nsVals.opportunityTemplates.renewable);
                console.log('setting default values == customform'+customForm)
                currentRecord.setValue({
                    fieldId: nsIds.oppSalesProcess_VoltageClass,
                    value: nsVals.voltageClasses.class35kv
                });
                currentRecord.setValue({
                    fieldId: nsIds.oppSalesProcess_LineToGroundVoltage,
                    value: '19.9'
                });
    
                currentRecord.setValue({
                    fieldId: nsIds.oppSalesProcess_InstallType,
                    value: nsVals.installTypes.directBuried
                });
                currentRecord.setValue({
                    fieldId: nsIds.oppSalesProcess_CableInsulationType,
                    value: nsVals.insulationTypes.trxlpe
                });
                currentRecord.setValue({
                    fieldId: nsIds.oppSalesProcess_CableShieldType,
                    value: nsVals.shieldTypes.concentric
                });
                currentRecord.setValue({
                    fieldId: nsIds.oppSalesProcess_CableConductorType,
                    value: nsVals.conductorTypes.strand
                });
    
                break;
            default:
                break;
        }
    }

    function _hideMarketSector(context) {
        //var recordObj = context.currentRecord;
        console.log('hiding market sector')
        jQuery('#' + nsIds.oppMarketSector).closest('tr').hide();
    }

    function _handleMarketSectorChange(context) {
        var recordObj = context.currentRecord;
        var marketSectorId = recordObj.getValue({ fieldId: nsIds.oppMarketSectorScripted });
        recordObj.setValue({ fieldId: nsIds.oppMarketSector, value: marketSectorId });
    }

    function _verifyCompetitionOtherField(context) {
        var recordObj = context.currentRecord;
        var competition = recordObj.getValue({ fieldId: nsIds.oppCompetition });
        var competitionOther = recordObj.getValue({ fieldId: nsIds.oppCompetitionOther });
    
        if (+competition === nsVals.competition.other) {
            if (competitionOther.length < 3) {
                throw new Error('If "Other" is selected for Competition, then at least three characters must be written in the "Other Competition" field.');
            }
        }
    
        return true;
    }
    function updateSubtabTitle (subtabTitle, newTitleId, newTitle) {
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


      function isFormMatching(context) {
        var bool = 0;
        var script = runtime.getCurrentScript();

        var formParameterId = script.getParameter({ name: 'custscript_opp_forms' });
		
		if(formParameterId!='' && formParameterId && formParameterId!=' '){
			var forms = formParameterId.split(',');

			var rec = context.currentRecord;

			var currentFormId = rec.getValue({ fieldId: 'customform' });

			if(forms.indexOf(currentFormId)>=0){
				bool = 1;
				
			}else{
				bool = 0;
			}
		}
        
        return bool;
    }
	function formatNumber(number) {
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
    function getFilteredMarkets(context,marketTypeId) {
        //var record = context.currentRecord;
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

    return {
        pageInit: _client_pageInit,
        fieldChanged: _client_fieldChanged,
        saveRecord: _client_saveRecord,
        sublistChanged:_client_recalc
    };
});