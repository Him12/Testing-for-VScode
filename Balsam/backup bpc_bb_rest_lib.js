/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author
 */
define(['N/runtime', 'N/https', 'N/search', 'N/query', 'N/record', 'N/crypto/random'], /**
 * @param {runtime} runtime
 * @param {https} https
 * @param {search} search
 * @param {query} query
 * @param {record} record
 * @param {random} random
 */ (runtime, https, search, query, record, random) => {
  // ===== Constants and Configuration =====
  const SalesChannels = {
    // Named constants
    AMAZON: { id: 1, name: 'Amazon' },
    WALMART: { id: 5, name: 'Walmart' },
    NORDSTROM: { id: 10, name: 'Nordstrom' },
    WILLIAM_SONOMA: { id: 12, name: 'William Sonoma' },
    NORDSTROM_RACK: { id: 14, name: 'Nordstrom Rack' },
    POTTERY_BARN: { id: 16, name: 'Pottery Barn' },
    TIKTOK: { id: 19, name: 'Tik Tok' },

    // ID lookup table for quick access by ID
    byId: {},

    // Default for unknown channels
    DEFAULT: { id: 0, name: 'Unknown' }
  };

  const RequestType = {
    salesOrderSummary: { id: 5, name: 'Sales Order Summary' },
    giftee: { id: 1, name: 'Giftee' },
    shipmentNotification: { id: 2, name: 'Shipment Notification' },
    returnConfirmation: { id: 6, name: 'Return Confirmation' }
  };

  // Populate the byId lookup table
  Object.values(SalesChannels).forEach((channel) => {
    if (channel.id !== undefined) {
      SalesChannels.byId[channel.id] = channel;
    }
  });

  // ===== Core Utility Functions =====
  /**
   * Executes a SuiteQL query and retrieves all pages of results.
   * @param {string} suiteQL - The SuiteQL query string to execute
   * @returns {Object[]} - Array of result objects with properties mapped to field names
   */
  const processSuiteQL = (suiteQL) => {
    /** @type {query.PagedData} */
    const pagedData = query.runSuiteQLPaged({ query: suiteQL, pageSize: 1000 });
    return pagedData.pageRanges.reduce(
      (results, _, index) => results.concat(pagedData.fetch({ index }).data.asMappedResults()),
      []
    );
  };

  /**
   * Recursively converts all values in an object to strings
   * @param {Object|Array|any} obj - The object to convert
   * @return {Object|Array|string} - The object with all values as strings
   */
  const convertAllValuesToStrings = (obj) => {
    if (obj === null || obj === undefined) {
      return '';
    }

    if (typeof obj !== 'object') {
      // Convert primitive values to strings
      return String(obj);
    }

    if (Array.isArray(obj)) {
      // Handle arrays
      return obj.map((item) => convertAllValuesToStrings(item));
    }

    // Handle objects
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = convertAllValuesToStrings(obj[key]);
      }
    }

    return result;
  };

  // ===== Configuration Retrieval Functions =====
  /**
   * Gets the API configuration record by either request type ID or sales channel ID
   * @param {Object} config - Configuration object with either requestTypeId or salesChannelId
   * @return {Object|null} - The API configuration object or null if not found
   */
  const getConfigRecord = (config = {}) => {
    try {
      const { requestTypeId, salesChannelId } = config;

      // If neither parameter is provided, return null
      if (requestTypeId === undefined && salesChannelId === undefined) {
        log.debug('Missing parameters', 'Either requestTypeId or salesChannelId must be provided');
        return null;
      }

      // Determine which query to run based on available parameter
      let whereClause = '';
      if (salesChannelId !== undefined) {
        whereClause = `ac.custrecord_bpc_bb_sales_channel = ${salesChannelId}`;
      } else {
        whereClause = `ac.custrecord_bpc_bb_request_type = ${requestTypeId}`;
      }

      // Use SuiteQL to query the API config record
      const results = processSuiteQL(`
    SELECT 
      ac.id AS api_config_id,
      ac.custrecord_bpc_bb_msapic_base_url AS base_url,
      ac.custrecord_bpc_bb_msapic_resource_path AS resource_path,
      ac.custrecord_bpc_bb_msapic_client_id AS client_id,
      ac.custrecord_bpc_bb_msapic_secret_id AS secret_id,
      ac.custrecord_bpc_bb_request_type AS request_type
    FROM 
      customrecord_bpc_bb_mulesoft_api_config ac
    WHERE 
      ${whereClause}
    `);

      // If we found a config record, return the complete config object
      if (results && results.length > 0) {
        const config = results[0];

        return {
          id: config.api_config_id,
          baseUrl: config.base_url,
          resourcePath: config.resource_path,
          clientId: config.client_id,
          secretId: config.secret_id,
          requestType: config.request_type
        };
      }

      // If no config record was found, log it and return null
      log.debug('No API configuration found', config);
      return null;
    } catch (e) {
      log.error('Error in getConfigRecord', e);
      return null;
    }
  };

  // ===== Data Query Functions =====
  /**
   * Query to get fulfillment fields
   * @param {Number} ifId - Data to send
   * @return {Object[]} - Query Results
   */
  const lookupFulfillmentFields = (ifId) => {
    return processSuiteQL(
      `SELECT
          so.otherrefnum,
          so.tranid,
          so.id soid,
          t.id as fulfillmentid,
          t.cseg_geo as geo, 
          t.shipmethod,
          tl.item,
          tl.location,
          tl.quantity * -1 as quantity,
          tl.custcol_bpc_bb_tracking_numbers,
          tl.custcol_bb_bpc_narvar_url,
          tl.custcol_bb_bpc_vendor_item_descriptio,
          tl.custcol_bpc_bb_line_item_id,
          tl.custcol_bpc_bb_vendor_sku,
          t.custbody_bb_bpc_wis_shipdate_time,
          tl.custcol_bpc_bb_shipping_carrier,
          tl.custcol_bpc_bb_shipping_method,
          tl.custcol_if_bol_col_weight,
          tl.custcol_bb_bpc_parent_line_id,
          tl.custcol_bpc_bb_upc_bundle_id,
          tsa.addressee,
          tsa.addr1,
          tsa.addr2,
          tsa.city,
          tsa.state,
          tsa.zip,
          tsa.country,
          item.itemid,
          item.parent,
          item.custitem_bpc_bb_carton_weight_value,
          item.custitem_bpc_bb_carton_total_count,
          item.custitem_bpc_bb_image_url as imageURL,
          parentitem.itemid as parent_itemid,
          parentitem.displayname as parent_displayname,
          lma.addr1 locationaddress1,
          lma.addr2 locationaddress2,
          lma.city locationcity,
          lma.state locationstate,
          lma.zip locationzip,
          lma.country locationcountry,
          lma.addressee locationaddressee,
        FROM transaction t
          LEFT JOIN nexttransactionlink ntl ON ntl.nextdoc = t.id
          LEFT JOIN transaction so ON ntl.previousdoc = so.id
          LEFT JOIN transactionline tl ON tl.transaction = t.id
          LEFT JOIN transactionshippingaddress tsa ON t.shippingaddress = tsa.nkey
          LEFT JOIN item ON tl.item = item.id
          LEFT JOIN unitstypeuom uom ON uom.internalid = tl.units
          LEFT JOIN item parentitem ON item.parent = parentitem.id
          LEFT JOIN location ON tl.location = location.id
          LEFT JOIN locationmainaddress lma ON location.mainaddress = lma.nkey
        WHERE
          t.recordtype = 'itemfulfillment'
          AND tl.iscogs = 'F'
          AND tl.itemtype <> 'ShipItem'
          AND t.id = ${ifId}`
    );
  };

  /**
   * Query to get fulfillment fields
   * @param {Number} salesOrderId - Data to send
   * @return {Object[]} - Query Results
   */
  const lookupFulfillmentFieldsFromSalesOrder = (salesOrderId) => {
    return processSuiteQL(`SELECT
        so.tranid,
        so.custbody_bpc_bb_blsm_ordercreationonp,
        so.id soid,
        so.trandate,
        so.custbody_bpc_bb_min_est_del_date as minshipdate,
        so.custbody_bpc_bb_max_est_del_date as maxshipdate,
        BUILTIN.DF(so.cseg_geo) as sogeo,
        so.email,
        if.id as fulfillmentid,
        if.shipmethod,
        ifl.item,
        ifl.location,
        ifl.quantity * -1 as quantity,
        ifl.custcol_bpc_bb_tracking_numbers,
        ifl.custcol_bb_bpc_narvar_url,
        ifl.custcol_bb_bpc_vendor_item_descriptio,
        ifl.custcol_bpc_bb_line_item_id,
        ifl.custcol_bpc_bb_vendor_sku,
        if.custbody_bb_bpc_wis_shipdate_time,
        ifl.custcol_bpc_bb_shipping_carrier,
        ifl.custcol_bpc_bb_shipping_method,
        ifl.custcol_if_bol_col_weight,
        ifl.custcol_bb_bpc_parent_line_id,
        ifl.custcol_bpc_bb_upc_bundle_id,
        tsa.addressee,
        tsa.addr1,
        tsa.addr2,
        tsa.city,
        tsa.state,
        tsa.zip,
        tsa.country,
        tsa.addrphone,
        item.itemid,
        item.parent,
        item.custitem_bpc_bb_carton_weight_value,
        item.custitem_bpc_bb_bh_cartonnumber,
        item.custitem_bpc_bb_carton_total_count,
        item.custitem_bpc_bb_image_url as imageURL,
        parentitem.itemid as parent_itemid,
        parentitem.displayname as parent_displayname,
        lma.addr1 locationaddress1,
        lma.addr2 locationaddress2,
        lma.city locationcity,
        lma.state locationstate,
        lma.zip locationzip,
        lma.country locationcountry,
        lma.addressee locationaddressee,
        lma.addrphone as locationphone
      FROM transaction so
        LEFT JOIN nexttransactionlink ntl ON ntl.previousdoc = so.id
        LEFT JOIN transaction if ON ntl.nextdoc = if.id
        LEFT JOIN transactionline ifl ON ifl.transaction = if.id
        LEFT JOIN transactionshippingaddress tsa ON if.shippingaddress = tsa.nkey
        LEFT JOIN item ON ifl.item = item.id
        LEFT JOIN unitstypeuom uom ON uom.internalid = ifl.units
        LEFT JOIN item parentitem ON item.parent = parentitem.id
        LEFT JOIN location ON ifl.location = location.id
        LEFT JOIN locationmainaddress lma ON location.mainaddress = lma.nkey
      WHERE
        so.recordtype = 'salesorder'
        AND if.recordtype = 'itemfulfillment'
        AND ifl.iscogs = 'F'
        AND ifl.itemtype <> 'ShipItem'
        AND so.id = ${salesOrderId}`);
  };

  /**
   * Gets sales order data when no fulfillments exist
   * @param {string} salesOrderId - The ID of the sales order
   * @return {Object[]} Sales order data with line items
   */
  const getSalesOrderDataForSummary = (salesOrderId) => {
    return processSuiteQL(`
      SELECT 
        so.tranid,
        so.id as soid,
        so.trandate,
        so.custbody_bpc_bb_blsm_ordercreationonp,
        so.custbody_bpc_bb_min_est_del_date as minshipdate,
        so.custbody_bpc_bb_max_est_del_date as maxshipdate,
        BUILTIN.DF(so.cseg_geo) as sogeo,
        so.email,
        tsa.addressee,
        tsa.addr1,
        tsa.addr2,
        tsa.city,
        tsa.state,
        tsa.zip,
        tsa.country,
        tsa.addrphone,
        sol.custcol_bpc_bb_line_item_id,
        sol.custcol_bb_bpc_parent_line_id,
        sol.item,
        item.itemid,
        item.displayname,
        item.custitem_bpc_bb_image_url as imageURL
      FROM transaction so
      LEFT JOIN transactionshippingaddress tsa ON so.shippingaddress = tsa.nkey
      LEFT JOIN transactionline sol ON sol.transaction = so.id
      LEFT JOIN item ON sol.item = item.id
      WHERE so.id = ${salesOrderId}
      AND so.recordtype = 'salesorder'
      AND sol.itemtype NOT IN ('ShipItem', 'TaxItem')
      AND sol.iscogs = 'F'
    `);
  };

  /**
   * Retrieves the Sales Order JSON data for all lines
   * @param {string} salesOrderId - The ID of the sales order
   * @return {Object} - Map of line IDs to their JSON data
   */
  const getSalesOrderJsonData = (salesOrderId) => {
    if (!salesOrderId) {
      return {};
    }

    const results = processSuiteQL(`
    SELECT 
      tl.custcol_bpc_bb_line_item_id,
      tl.custcol_bpc_bb_json
    FROM 
      transactionline tl
    WHERE 
      tl.transaction = ${salesOrderId}
      AND tl.custcol_bpc_bb_json IS NOT NULL
  `);

    // Create a map of line IDs to JSON data
    const jsonDataMap = {};
    results.forEach((row) => {
      if (row.custcol_bpc_bb_line_item_id && row.custcol_bpc_bb_json) {
        try {
          jsonDataMap[row.custcol_bpc_bb_line_item_id] = JSON.parse(row.custcol_bpc_bb_json);
        } catch (e) {
          log.error('Error parsing JSON for line', {
            lineId: row.custcol_bpc_bb_line_item_id,
            error: e
          });
        }
      }
    });

    return jsonDataMap;
  };

  /**
   * Query to get RMA (Return Authorization) fields and related data
   * @param {Number} rmaId - Return Authorization ID
   * @return {Object[]} - Query Results
   */
  const lookupReturnAuthorizationFields = (rmaId) => {
    return processSuiteQL(`
      SELECT 
        rma.id as rmaid,
        rma.tranid as rmatranid,
        rma.trandate as rmadate,
        rma.entity as customer,
        rma.custbody_bpc_bb_addr_email as customeremail,
        rma.custbody_bpc_bb_pickup_date,
        so.id as soid,
        so.tranid as sotranid,
        so.custbody_bpc_bb_blsm_ordercreationonp as orderdate,
        BUILTIN.DF(so.cseg_geo) as geo,
        cust.firstname as customerfirstname,
        cust.lastname as customerlastname,
        rmal.item,
        rmal.quantity,
        rmal.custcol_bpc_bb_line_item_id,
        rmal.custcol_bpc_bb_vendor_sku,
        rmal.custcol_bb_bpc_parent_line_id,
        rmal.custcol_bpc_bb_tracking_numbers,
        rmal.custcol_bb_bpc_narvar_url,
        rmal.custcol_bpc_bb_total_restocking_fee totalrestockingfee,
        rmal.custcol_bpc_bb_label_fee labelfee,
        rmal.rate as unitprice,
        rmal.amount,
        item.parent as upcparent,
        item.custitem_bpc_bb_bh_cartonnumber as cartonnumber,
        item.custitem_bpc_bb_carton_total_count as totalcartons,
        item.custitem_bpc_bb_item_type as itemtype,
        item.custitem_bpc_bb_image_url as imageurl,
        sol.item as skuitem,
        sol.quantity as skuquantity,
        skuitem.itemid as skuitemid,
        skuitem.displayname as skudisplayname
      FROM transaction rma
        LEFT JOIN nexttransactionlink ntl ON ntl.nextdoc = rma.id
        LEFT JOIN transaction so ON ntl.previousdoc = so.id
        LEFT JOIN transactionline rmal ON rmal.transaction = rma.id
        LEFT JOIN item ON rmal.item = item.id
        LEFT JOIN customer cust ON rma.entity = cust.id
        LEFT JOIN transactionline sol ON sol.transaction = so.id 
          AND sol.custcol_bpc_bb_line_item_id = rmal.custcol_bb_bpc_parent_line_id
        LEFT JOIN item skuitem ON sol.item = skuitem.id
      WHERE 
        rma.recordtype = 'returnauthorization'
        AND rmal.iscogs = 'F'
        AND rmal.itemtype NOT IN ('ShipItem', 'TaxItem')
        AND rmal.custcol_bpc_bb_item_type != 'Return Fees'
        AND rma.id = ${rmaId}
    `);
  };

  // ===== Validation Functions =====
  /**
   * Checks if an API log record already exists for this transaction
   * @param {number} transactionId - The ID of the transaction
   * @return {boolean} True if a log exists, false otherwise
   */
  const hasExistingApiLog = (transactionId) => {
    try {
      const results = processSuiteQL(`
      SELECT COUNT(*) as count
      FROM customrecord_bpc_bb_mulesoft_api_log
      WHERE custrecord_bpc_bb_msapirl_transaction = ${transactionId}
    `);

      if (results && results.length > 0) {
        const count = parseInt(results[0].count, 10) || 0;

        log.debug('API Log Check', {
          transactionId,
          existingLogs: count
        });

        // If count is greater than 0, we have existing logs
        return count > 0;
      }

      return false;
    } catch (e) {
      log.error('Error in hasExistingApiLog', e);
      // In case of error, return false to continue with processing
      return false;
    }
  };

  /**
   * Validates if the sales channel should be processed
   * @param {number|string} salesChannelId - The sales channel ID
   * @param {number[]} validChannels - Valid sales channel IDs
   * @return {boolean} Whether the sales channel should be processed
   */
  const isValidSalesChannel = (salesChannelId, validChannels) => {
    return validChannels.includes(Number(salesChannelId));
  };

  /**
   * Checks if all items on a sales order have been shipped
   * @param {number} fulfillmentId - The ID of the fulfillment record
   * @return {boolean} True if all items have been shipped, false otherwise
   */
  const allItemsShipped = (fulfillmentId) => {
    try {
      // Use lookupFields to get the sales order ID (more efficient)
      const fulfillmentFields = search.lookupFields({
        type: record.Type.ITEM_FULFILLMENT,
        id: fulfillmentId,
        columns: ['createdfrom']
      });

      if (!fulfillmentFields.createdfrom || !fulfillmentFields.createdfrom[0]) {
        log.error('No sales order found for fulfillment', fulfillmentId);
        return false;
      }

      const salesOrderId = fulfillmentFields.createdfrom[0].value;

      if (!salesOrderId) {
        log.error('No sales order ID found for fulfillment', fulfillmentId);
        return false;
      }

      // Get all items that should be fulfilled (those with parent_line_id populated which are UPC's, don't process skus)
      const salesOrderItems = processSuiteQL(`
      SELECT 
        sol.item,
        sol.quantity * -1 as orderedquantity
      FROM 
        transactionline sol
      WHERE 
        sol.transaction = ${salesOrderId}
        AND sol.itemtype NOT IN ('ShipItem', 'TaxItem')
        AND sol.iscogs = 'F'
        AND sol.custcol_bb_bpc_parent_line_id IS NOT NULL
    `);

      // Get all fulfilled items across all fulfillments for this sales order
      const fulfilledItems = processSuiteQL(`
      SELECT 
        ifl.item,
        SUM(ifl.quantity * -1) as fulfilledquantity
      FROM 
        transaction if
        JOIN nexttransactionlink ntl ON ntl.nextdoc = if.id
        JOIN transaction so ON ntl.previousdoc = so.id
        JOIN transactionline ifl ON ifl.transaction = if.id
      WHERE 
        so.id = ${salesOrderId}
        AND if.recordtype = 'itemfulfillment'
        AND ifl.iscogs = 'F'
        AND ifl.itemtype NOT IN ('ShipItem', 'TaxItem')
      GROUP BY
        ifl.item
    `);

      // Create a map of fulfilled quantities by item ID
      const fulfilledQuantityMap = {};
      fulfilledItems.forEach((item) => {
        fulfilledQuantityMap[item.item] = parseFloat(item.fulfilledquantity) || 0;
      });

      log.debug('fulfilledQuantityMap', {
        salesOrderId,
        fulfilledQuantityMap
      });

      // Check if any items are not fully fulfilled
      const unfulfilled = salesOrderItems.filter((item) => {
        const orderedQuantity = parseFloat(item.orderedquantity) || 0;
        const fulfilledQuantity = fulfilledQuantityMap[item.item] || 0;
        return fulfilledQuantity < orderedQuantity;
      });

      // If there are no unfulfilled items, all items have been shipped
      const shipped = unfulfilled.length === 0;

      log.debug('All Items Fulfillment Check', {
        fulfillmentId,
        salesOrderId,
        shipped,
        unfulfilled: unfulfilled.length,
        unfulfilled_items: unfulfilled
      });

      return shipped;
    } catch (e) {
      log.error('Error in allItemsShipped', e);
      // In case of error, return true to allow processing to continue
      return true;
    }
  };

  /**
   * Determines if an ASN should be triggered based on the UPC bundle logic
   * @param {number} fulfillmentId - The ID of the current fulfillment record
   * @return {boolean} True if ASN should be triggered, false otherwise
   */
  const shouldTriggerASN = (fulfillmentId) => {
    try {
      // Get the current fulfillment data
      const fulfillmentData = lookupFulfillmentFields(fulfillmentId);

      if (fulfillmentData.length === 0) {
        log.error('No data found for fulfillment', fulfillmentId);
        return false;
      }

      // Get Sales Order ID from the first row
      const salesOrderId = fulfillmentData[0].soid;
      if (!salesOrderId) {
        log.error('No sales order ID found for fulfillment', fulfillmentId);
        return false;
      }

      // Check if this specific fulfillment already has an API log
      if (hasExistingApiLog(fulfillmentId)) {
        log.debug('This fulfillment already processed', { fulfillmentId });
        return false;
      }

      log.debug('Analyzing fulfillment in context of sales order', {
        fulfillmentId,
        salesOrderId
      });

      // Get ALL fulfillments related to this sales order
      const allSalesOrderFulfillments = lookupFulfillmentFieldsFromSalesOrder(salesOrderId);

      // Track bundle quantities fulfilled by each fulfillment
      const bundleQuantitiesByFulfillment = {};
      // Track which bundles are in the current fulfillment
      const bundlesInCurrentFulfillment = new Set();
      // Get carton total counts for each parent SKU from UPC fulfillment data
      const skuCartonCounts = {};

      allSalesOrderFulfillments.forEach((item) => {
        // Only process UPCs (items with parent_line_id)
        if (item.custcol_bb_bpc_parent_line_id) {
          const parentLineId = item.custcol_bb_bpc_parent_line_id;
          const bundleId = item.custcol_bpc_bb_upc_bundle_id || 'default';
          const bundleKey = `${parentLineId}_${bundleId}`;
          const quantity = Math.abs(parseFloat(item.quantity)) || 0;
          const currentFulfillmentId = item.fulfillmentid;

          // Store carton total count for parent SKU from UPC item (first time we see this parent)
          if (!skuCartonCounts[parentLineId] && item.custitem_bpc_bb_carton_total_count) {
            skuCartonCounts[parentLineId] = parseInt(item.custitem_bpc_bb_carton_total_count) || 1;
          }

          // Initialize tracking structures
          if (!bundleQuantitiesByFulfillment[bundleKey]) {
            bundleQuantitiesByFulfillment[bundleKey] = {};
          }

          if (!bundleQuantitiesByFulfillment[bundleKey][currentFulfillmentId]) {
            bundleQuantitiesByFulfillment[bundleKey][currentFulfillmentId] = 0;
          }

          // Add quantity to this fulfillment's total for this bundle
          bundleQuantitiesByFulfillment[bundleKey][currentFulfillmentId] += quantity;

          // If this is our target fulfillment, track its bundles
          if (currentFulfillmentId == fulfillmentId) {
            bundlesInCurrentFulfillment.add(bundleKey);
          }
        }
      });

      log.debug('All fulfillments for this sales order', {
        salesOrderId,
        totalItems: allSalesOrderFulfillments.length
      });

      log.debug('Bundle quantities by fulfillment', { bundleQuantitiesByFulfillment });
      log.debug('Bundles in current fulfillment', {
        bundlesInCurrentFulfillment: Array.from(bundlesInCurrentFulfillment)
      });

      // Check each bundle in the current fulfillment
      for (const bundleKey of bundlesInCurrentFulfillment) {
        const [parentLineId, bundleId] = bundleKey.split('_');
        const cartonTotalCount = skuCartonCounts[parentLineId] || 1;

        // Get all fulfillments that have processed this bundle, sorted chronologically
        const fulfillmentsForBundle = Object.keys(
          bundleQuantitiesByFulfillment[bundleKey] || {}
        ).sort((a, b) => a - b);

        log.debug('Analyzing bundle', {
          bundleKey,
          parentLineId,
          bundleId,
          cartonTotalCount,
          fulfillmentsForBundle
        });

        // Calculate cumulative bundle quantities before current fulfillment
        let cumulativeQuantityBefore = 0;

        fulfillmentsForBundle.forEach((fId) => {
          const qty = bundleQuantitiesByFulfillment[bundleKey][fId] || 0;
          if (fId < fulfillmentId) {
            cumulativeQuantityBefore += qty;
          }
        });

        log.debug('Bundle unit analysis', {
          bundleKey,
          cumulativeQuantityBefore,
          cartonTotalCount,
          isStartingNewUnit: cumulativeQuantityBefore % cartonTotalCount === 0
        });

        // If this fulfillment starts a new unit of the bundle, trigger ASN
        // This happens when the quantity before represents complete units
        if (cumulativeQuantityBefore % cartonTotalCount === 0) {
          log.debug('ASN should be triggered', {
            fulfillmentId,
            bundleKey,
            reason:
              cumulativeQuantityBefore === 0
                ? 'First fulfillment for bundle'
                : 'Starting new bundle unit'
          });
          return true;
        }
      }

      // If we reached here, this fulfillment doesn't start a new bundle unit
      log.debug('No new bundle units started in this fulfillment', { fulfillmentId });
      return false;
    } catch (e) {
      log.error('Error in shouldTriggerASN', e);
      // In case of error, return true to allow processing to continue
      return true;
    }
  };

  /**
   * Validates if the event type is valid for processing depending on the sales channel
   * @param {number} recordId - The record ID
   * @param {number} salesChannelId - The sales channel ID
   * @return {boolean} Whether the record is ready for processing
   */
  const isReadyForProcessing = (recordId, salesChannelId) => {
    // First check if we already have a log record for this transaction
    if (hasExistingApiLog(recordId)) {
      log.debug('Record already processed', `Record ID: ${recordId}`);
      return false;
    }

    // If no existing log, continue with the original channel-based validation
    switch (Number(salesChannelId)) {
      case SalesChannels.AMAZON.id:
      case SalesChannels.WALMART.id:
      case SalesChannels.NORDSTROM.id:
      case SalesChannels.NORDSTROM_RACK.id:
      case SalesChannels.TIKTOK.id:
        return shouldTriggerASN(recordId);
      case SalesChannels.WILLIAM_SONOMA.id:
      case SalesChannels.POTTERY_BARN.id:
      default:
        return allItemsShipped(recordId);
    }
  };

  // ===== Data Processing Functions =====
  /**
   * Extracts Header Fields from fulfillment data
   * @param {Object} firstRow - The first row of fulfillment data
   * @param {Object} apiConfig - The API configuration object
   * @return {Object} Header information
   */
  const processHeaderFields = (firstRow, apiConfig) => {
    return {
      emailType: apiConfig.requestType,
      soOtherRefNum: firstRow.otherrefnum || '',
      soTranId: firstRow.tranid || '',
      soId: firstRow.soid || '',
      fulfillmentId: firstRow.fulfillmentid || '',
      shipMethod: firstRow.shipmethod || '',
      geo: firstRow.geo || '',
      shipDate: firstRow.custbody_bb_bpc_wis_shipdate_time || '',
      addressee: firstRow.addressee || '',
      addr1: firstRow.addr1 || '',
      addr2: firstRow.addr2 || '',
      addr3: firstRow.addr3 || '',
      city: firstRow.city || '',
      state: firstRow.state || '',
      zip: firstRow.zip || '',
      country: firstRow.country || '',
      addrPhone: firstRow.addrphone || ''
    };
  };

  /**
   * Processes line items from fulfillment data
   * @param {Object[]} fulfillmentRows - Rows of fulfillment data
   * @param {number} salesChannelId - The sales channel id
   * @return {Object[]} Processed line items
   */
  const processLineItems = (fulfillmentRows, salesChannelId) => {
    // Check if we need special processing for William Sonoma or Pottery Barn
    const channelId = Number(salesChannelId);
    const isSpecialChannel = [
      SalesChannels.WILLIAM_SONOMA.id,
      SalesChannels.POTTERY_BARN.id
    ].includes(channelId);

    // If this is a special channel, get all JSON data from the sales order
    let jsonDataMap = {};
    if (isSpecialChannel && fulfillmentRows.length > 0) {
      const salesOrderId = fulfillmentRows[0].soid;
      jsonDataMap = getSalesOrderJsonData(salesOrderId);
    }

    return fulfillmentRows.map((row) => {
      let vendorItemDescription = row.custcol_bb_bpc_vendor_item_descriptio || '';
      let unitPrice = '';

      // For William Sonoma and Pottery Barn, try to get description from JSON
      if (isSpecialChannel && row.custcol_bb_bpc_parent_line_id && row.custcol_bpc_bb_vendor_sku) {
        const jsonData = jsonDataMap[row.custcol_bb_bpc_parent_line_id];

        if (Array.isArray(jsonData)) {
          // Find the matching item in the JSON array
          const matchingItem = jsonData.find(
            (item) => item.vendorSKU === row.custcol_bpc_bb_vendor_sku
          );

          if (matchingItem) {
            vendorItemDescription = matchingItem.itemDescription;
            unitPrice = matchingItem.unitPrice;
            log.debug('Found vendor item description from JSON', {
              vendorSku: row.custcol_bpc_bb_vendor_sku,
              vendorItemDescription,
              unitPrice
            });
          }
        }
      }

      return {
        item: row.item || '',
        imageURL: row.imageUrl || '',
        location: row.location || '',
        quantity: row.quantity || '',
        trackingNumber: row.custcol_bpc_bb_tracking_numbers || '',
        narvarUrl: row.custcol_bb_bpc_narvar_url || '',
        vendorItemDescription,
        unitPrice,
        lineItemId: row.custcol_bpc_bb_line_item_id || '',
        vendorSku: row.custcol_bpc_bb_vendor_sku,
        shippingCarrier: row.custcol_bpc_bb_shipping_carrier || '',
        shippingMethod: row.custcol_bpc_bb_shipping_method || '',
        weight: row.custcol_if_bol_col_weight || '',
        itemId: row.itemid || '',
        itemParent: row.parent,
        itemCartonWeight: row.custitem_carton_weight_value || '',
        itemCartonTotalCount: row.custitem_carton_total_count || '',
        parentItemId: row.parent_itemid || '',
        parentDisplayName: row.parent_displayname || '',
        locationAddress1: row.locationaddress1 || '',
        locationAddress2: row.locationaddress2 || '',
        locationCity: row.locationcity || '',
        locationState: row.locationstate || '',
        locationZip: row.locationzip || '',
        locationCountry: row.locationcountry || '',
        locationAddressee: row.locationaddressee || ''
      };
    });
  };

  /**
   * Processes the header fields for a sales order summary (works with fulfillment or sales order data)
   * @param {Object} firstRow - The first row of fulfillment or sales order data
   * @param {Object} apiConfig - The API configuration object
   * @return {Object} Header information for sales order summary
   */
  const processSalesOrderSummaryHeaderFields = (firstRow, apiConfig) => {
    log.debug('Processing Sales Order Summary Header Fields', { firstRow, apiConfig });
    return {
      emailType: 'SalesOrderSummary',
      soTranId: firstRow.tranid || '',
      orderDate: firstRow.custbody_bpc_bb_blsm_ordercreationonp || '',
      geo: firstRow.sogeo || firstRow.geo || '',
      email: firstRow.email || '',
      minShipDate: firstRow.minshipdate || '',
      maxShipDate: firstRow.maxshipdate || '',
      addressee: firstRow.addressee || '',
      addr1: firstRow.addr1 || '',
      addr2: firstRow.addr2 || '',
      addr3: firstRow.addr3 || '',
      city: firstRow.city || '',
      state: firstRow.state || '',
      zip: firstRow.zip || '',
      country: firstRow.country || '',
      addrPhone: firstRow.addrphone || firstRow.locationphone || ''
    };
  };

  /**
   * Processes line items from both sales order and fulfillment data for proper SKU/UPC grouping
   * @param {Object[]} salesOrderRows - Rows of sales order data (includes all SKUs and UPCs)
   * @param {Object[]} fulfillmentRows - Rows of fulfillment data (includes tracking for fulfilled UPCs)
   * @return {Object[]} Processed line items grouped by parent SKU
   */
  const processSalesOrderSummaryLineItems = (salesOrderRows, fulfillmentRows = []) => {
    // Create maps to organize data
    const parentLinesMap = new Map(); // key: lineItemId, value: parent line data
    const allUPCsMap = new Map(); // key: parentLineId, value: Set of UPC data
    const fulfilledUPCsMap = new Map(); // key: UPC itemId, value: tracking data array

    // First pass: get all parent lines and UPCs from sales order data
    salesOrderRows.forEach((row) => {
      const lineItemId = row.custcol_bpc_bb_line_item_id || '';
      const parentLineId = row.custcol_bb_bpc_parent_line_id;

      if (!parentLineId) {
        // This is a parent line (SKU)
        if (!parentLinesMap.has(lineItemId)) {
          parentLinesMap.set(lineItemId, {
            lineItemId,
            itemId: row.itemid || '',
            productName: row.displayname || row.itemid || '',
            imageURL: row.custitem_bpc_bb_image_url || ''
          });
        }
      } else {
        // This is a child line (UPC) - add to the map for this parent
        if (!allUPCsMap.has(parentLineId)) {
          allUPCsMap.set(parentLineId, []);
        }

        // Check if this UPC is already in the array to avoid duplicates
        const existingUPC = allUPCsMap.get(parentLineId).find((upc) => upc.itemId === row.itemid);
        if (!existingUPC) {
          allUPCsMap.get(parentLineId).push({
            itemId: row.itemid || '',
            displayName: row.displayname || ''
          });
        }
      }
    });

    // Second pass: get tracking data for fulfilled UPCs and group by UPC
    fulfillmentRows.forEach((row) => {
      const upcItemId = row.itemid || '';

      if (!fulfilledUPCsMap.has(upcItemId)) {
        fulfilledUPCsMap.set(upcItemId, []);
      }

      // Add tracking info for this UPC (there might be multiple fulfillments)
      if (row.custcol_bpc_bb_tracking_numbers) {
        const trackingInfo = {
          trackingNumber: row.custcol_bpc_bb_tracking_numbers || '',
          cartonNumber: row.custitem_bpc_bb_bh_cartonnumber || '',
          totalCartons: row.custitem_bpc_bb_carton_total_count || '',
          trackingNumberUrl: row.custcol_bb_bpc_narvar_url || ''
        };

        // Avoid duplicate tracking numbers for the same UPC
        const exists = fulfilledUPCsMap
          .get(upcItemId)
          .some((t) => t.trackingNumber === trackingInfo.trackingNumber);

        if (!exists) {
          fulfilledUPCsMap.get(upcItemId).push(trackingInfo);
        }
      }
    });

    // Third pass: build final structure
    const result = [];

    parentLinesMap.forEach((parentData, parentLineId) => {
      const upcsForThisParent = allUPCsMap.get(parentLineId) || [];

      // Create tracking numbers array - one entry per UPC
      const trackingNumbers = [];

      upcsForThisParent.forEach((upcData) => {
        const fulfillmentDataArray = fulfilledUPCsMap.get(upcData.itemId) || [];

        if (fulfillmentDataArray.length > 0) {
          // UPC has been fulfilled - create entry for each tracking number
          fulfillmentDataArray.forEach((fulfillmentData) => {
            trackingNumbers.push({
              trackingNumber: fulfillmentData.trackingNumber,
              cartonNumber: fulfillmentData.cartonNumber,
              totalCartons: fulfillmentData.totalCartons,
              upc: upcData.itemId,
              trackingNumberUrl: fulfillmentData.trackingNumberUrl
            });
          });
        } else {
          // UPC has not been fulfilled - include only UPC
          trackingNumbers.push({
            trackingNumber: '',
            cartonNumber: '',
            totalCartons: '',
            upc: upcData.itemId,
            trackingNumberUrl: ''
          });
        }
      });

      result.push({
        lineItemId: parentData.lineItemId,
        itemId: parentData.itemId,
        productName: parentData.productName,
        imageURL: parentData.imageURL,
        trackingNumbers
      });
    });

    return result;
  };

  /**
   * Groups RMA line items by parent SKU
   * @param {Object[]} rmaData - Raw RMA data from query
   * @return {Object[]} - Line items grouped by SKU with tracking numbers
   */
  const processReturnLineItems = (rmaData) => {
    const productsMap = new Map();

    rmaData.forEach((row) => {
      const parentLineId = row.custcol_bb_bpc_parent_line_id;

      // Use the SKU information from the sales order (not the UPC info)
      const sku = row.skuitemid || '';

      // Group by parent line ID (which links to the SKU on the sales order)
      const groupKey = parentLineId || sku;

      if (!productsMap.has(groupKey)) {
        // Use the absolute value of skuquantity from the sales order
        const soQuantity = Math.abs(parseFloat(row.skuquantity) || 0);

        productsMap.set(groupKey, {
          itemId: sku || '',
          quantity: soQuantity,
          productName: row.skudisplayname || '',
          pickupDate: row.custbody_bpc_bb_pickup_date || '',
          imageURL: row.imageurl || '',
          trackingNumbers: []
        });
      }

      const product = productsMap.get(groupKey);

      // Add tracking number for this UPC
      if (row.custcol_bpc_bb_tracking_numbers || row.cartonnumber) {
        const trackingEntry = {
          cartonNumber: row.cartonnumber || '',
          totalCartons: row.totalcartons || '',
          trackingNumber: row.custcol_bpc_bb_tracking_numbers || '',
          returnLabelUrl: row.custcol_bb_bpc_narvar_url || ''
        };

        // Avoid duplicate tracking numbers
        const exists = product.trackingNumbers.some(
          (t) =>
            t.trackingNumber === trackingEntry.trackingNumber &&
            t.cartonNumber === trackingEntry.cartonNumber
        );

        if (!exists) {
          product.trackingNumbers.push(trackingEntry);
        }
      }
    });

    // Ensure each product has at least one entry in lineCharges and trackingNumbers
    productsMap.forEach((product) => {
      if (product.trackingNumbers.length === 0) {
        product.trackingNumbers.push({
          cartonNumber: '',
          totalCartons: '',
          trackingNumber: '',
          returnLabelUrl: ''
        });
      }
    });

    return Array.from(productsMap.values());
  };

  // ===== Payload Creation Functions =====
  /**
   * Creates a standardized marketplace payload with consistent structure
   * @param {Object} headerData - Header data
   * @param {Object[]} lineItems - Line items
   * @param {string} salesChannel - Name of the sales channel (e.g., "Amazon", "William Sonoma")
   * @param {string} vendorId - Vendor ID for the sales channel
   * @return {Object} Standardized payload structure
   */
  const createMarketplacePayload = (headerData, lineItems, salesChannel, vendorId) => {
    return {
      emailType: headerData.emailType,
      orderNumber: headerData.soTranId,
      otherRefNum: headerData.soOtherRefNum,
      vendorId,
      salesChannel,
      geo: headerData.geo,
      brand: 'Balsamhill', // Static value
      lineItems: lineItems.map((item) => ({
        lineItemId: item.lineItemId,
        quantity: item.quantity,
        sku: item.parentItemId || item.itemId,
        vendorSKU: item.vendorSku || '',
        vendorItemDescription: item.vendorItemDescription || '',
        unitPrice: item.unitPrice || '',
        narvarURL: item.narvarUrl || '',
        imageURL: item.imageUrl || '',
        trackingNumber: item.trackingNumber || '',
        shipDate: headerData.shipDate || '',
        shipCarrier: item.shippingCarrier || '',
        shipMethod: item.shippingMethod || '',
        shipWeight: item.weight || item.itemCartonWeight || '0',
        shipFrom: {
          addressee: item.locationAddressee || '',
          addr1: item.locationAddress1 || '',
          addr2: item.locationAddress2 || '',
          city: item.locationCity || '',
          state: item.locationState || '',
          country: item.locationCountry || '',
          zip: item.locationZip || ''
        }
      })),
      shipTo: {
        addressee: headerData.addressee || '',
        addr1: headerData.addr1 || '',
        addr2: headerData.addr2 || '',
        addr3: headerData.addr3 || '',
        city: headerData.city || '',
        state: headerData.state || '',
        zip: headerData.zip || '',
        country: headerData.country || '',
        addrPhone: headerData.addrPhone || ''
      }
    };
  };

  /**
   * @param headerData
   * @param lineItems
   * @returns {Object} - Payload for sales order summary
   */
  const createSalesOrderSummaryPayload = (headerData, lineItems) => {
    return {
      emailType: 'SalesOrderSummary',
      orderNumber: headerData.soTranId,
      orderDate: headerData.orderDate,
      geo: headerData.geo,
      maxShipDate: headerData.maxShipDate || '',
      minShipDate: headerData.minShipDate || '',
      email: headerData.email,
      lineItems: lineItems.map((item) => ({
        itemId: item.itemId,
        productName: item.productName,
        imageURL: item.imageURL || '',
        trackingNumbers: item.trackingNumbers || []
      })),
      shipTo: {
        addressee: headerData.addressee || '',
        addr1: headerData.addr1 || '',
        addr2: headerData.addr2 || '',
        addr3: headerData.addr3 || '',
        city: headerData.city || '',
        state: headerData.state || '',
        zip: headerData.zip || '',
        country: headerData.country || '',
        addrPhone: headerData.addrPhone || ''
      }
    };
  };

  // trackingNumbers: [
  //           {
  //             trackingNumber: item.trackingNumber || '',
  //             cartonNumber: item.cartonNumber || '',
  //             totalCartons: item.totalCartons || '',
  //             upc: item.upc || '',
  //             trackingNumberUrl: item.trackingNumberUrl || ''
  //           }
  //         ]

  const buildFulfillmentPayload = (headerData, lineItems, salesChannelId) => {
    const channelId = Number(salesChannelId);
    const channel = SalesChannels.byId[channelId] || SalesChannels.DEFAULT;

    return createMarketplacePayload(headerData, lineItems, channel.name, channelId.toString());
  };

  /**
   * Creates a giftee email payload from fulfillment data
   * @param {Array} fulfillmentItems - Array of fulfillment line items
   * @param {Object} headerData - Header information from first item
   * @return {Object} Giftee payload
   */
  const createGifteePayload = (fulfillmentItems, headerData) => {
    // Convert each fulfillment item to a line item
    const lineItems = fulfillmentItems.map((item) => ({
      itemId: item.itemid || '',
      productName: item.displayname || '',
      imageURL: item.custitem_bpc_bb_image_url || '',
      quantity: item.quantity || '',
      trackingNumbers: [
        {
          cartonNumber: item.custitem_bpc_bb_bh_cartonnumber || '',
          totalCartons: item.custitem_bpc_bb_carton_total_count || '',
          upc: item.upc || '',
          trackingNumber: item.custcol_bpc_bb_tracking_numbers || '',
          trackingNumberUrl: item.custcol_bb_bpc_narvar_url || ''
        }
      ]
    }));

    // Build the final payload
    return {
      emailType: 'Giftee',
      geo: headerData.geo || '',
      orderNumber: headerData.tranid || '',
      orderDate: headerData.trandate || '',
      shipDate: headerData.custbody_bb_bpc_wis_shipdate_time || '',
      gifteeEmail: headerData.custbody_bpc_bb_gift_email || '',
      giftMessage: headerData.custbody_bpc_bb_gift_message || '',
      lineItems,
      isLtl: headerData.custbody_bpc_contains_atleast_one_ltl,
      shipTo: {
        addressee: headerData.addressee || '',
        addr1: headerData.addr1 || '',
        addr2: headerData.addr2 || '',
        addr3: headerData.addr3 || '',
        city: headerData.city || '',
        state: headerData.state || '',
        zip: headerData.zip || '',
        country: headerData.country || '',
        addrPhone: headerData.addrphone || ''
      }
    };
  };

  // ===== Main Processing Functions =====
  /**
   * Process a fulfillment record for API delivery
   * @param {string} fulfillmentId - The ID of the fulfillment
   * @param {number} salesChannelId - The sales channel ID
   * @param {Object} apiConfig - The API configuration object
   * @return {Object} Result of processing
   */
  const processFulfillmentForApiDelivery = (fulfillmentId, salesChannelId, apiConfig) => {
    // Get fulfillment data
    const fulfillmentData = lookupFulfillmentFields(fulfillmentId);

    log.debug('Fulfillment Data Retrieved', {
      fulfillmentId,
      rowCount: fulfillmentData.length
    });

    if (fulfillmentData.length === 0) {
      log.error('No data found for fulfillment', fulfillmentId);
      return { success: false, message: 'No data found' };
    }

    // Process data
    const firstRow = fulfillmentData[0];
    const headerFields = processHeaderFields(firstRow, apiConfig);
    const lineItems = processLineItems(fulfillmentData, salesChannelId);
    log.debug('Processed Data', {
      headerFields,
      lineItems
    });
    const payload = buildFulfillmentPayload(headerFields, lineItems, salesChannelId);
    log.debug('Payload', payload);

    return payload;
  };

  /**
   * Process a sales order for summary email - works with or without fulfillments
   * @param {string} salesOrderId - The ID of the sales order
   * @param {Object} apiConfig - The API configuration object
   * @return {Object} Payload for sales order summary
   */
  const processSalesOrderSummary = (salesOrderId, apiConfig) => {
    try {
      // Always get both sales order data and fulfillment data
      const salesOrderData = getSalesOrderDataForSummary(salesOrderId);
      const fulfillmentData = lookupFulfillmentFieldsFromSalesOrder(salesOrderId);

      if (salesOrderData.length === 0) {
        log.error('No sales order data found', salesOrderId);
        return { success: false, message: 'Sales order not found' };
      }

      log.debug('Sales Order Processing', {
        salesOrderId,
        salesOrderRowCount: salesOrderData.length,
        fulfillmentRowCount: fulfillmentData.length,
        hasFulfillments: fulfillmentData.length > 0
      });

      const firstRow = salesOrderData[0];
      const headerFields = processSalesOrderSummaryHeaderFields(firstRow, apiConfig);

      // Process line items with both data sources
      const lineItems = processSalesOrderSummaryLineItems(salesOrderData, fulfillmentData);

      // Create the final payload
      const payload = createSalesOrderSummaryPayload(headerFields, lineItems);
      log.debug('Sales Order Summary Payload Created', {
        salesOrderId,
        hasFulfillments: fulfillmentData.length > 0,
        lineItemCount: lineItems.length
      });

      return payload;
    } catch (e) {
      log.error('Error in processSalesOrderSummary', e);
      return { success: false, message: e.message };
    }
  };

  /**
   * Process a return authorization for return confirmation email
   * @param {number} rmaId - The ID of the return authorization
   * @param {Object} apiConfig - The API configuration object
   * @return {Object} Payload for return confirmation email
   */
  const processReturnConfirmationEmail = (rmaId, apiConfig) => {
    try {
      log.debug('Processing Return Confirmation Email', { rmaId, apiConfig });

      // Get return authorization data
      const rmaData = lookupReturnAuthorizationFields(rmaId);

      log.debug('Raw RMA Data Retrieved', {
        rmaId,
        rowCount: rmaData.length,
        sampleData: rmaData.length > 0 ? rmaData[0] : null
      });

      if (rmaData.length === 0) {
        log.error('No data found for return authorization', rmaId);
        return { success: false, message: 'No return authorization data found' };
      }

      const firstRow = rmaData[0];
      const customerEmail = firstRow.customeremail || '';
      const geo = firstRow.geo || '';
      const rmaTransactionId = firstRow.rmatranid || '';
      const salesOrderId = firstRow.sotranid || '';
      const customerFirstName = firstRow.customerfirstname || '';

      // Calculate labelSubtotal as sum of amounts where item type is 'Return Fees'
      let labelSubtotal = 0;
      rmaData.forEach((row) => {
        const totalRestockingFee = row.totalrestockingfee || 0;
        const totalLabelFee = row.labelfee || 0;
        // Convert to positive number since RMA amounts are typically negative
        labelSubtotal += parseFloat(totalRestockingFee) + parseFloat(totalLabelFee);
      });

      // Convert to string format
      const labelSubtotalStr = labelSubtotal.toFixed(2);

      // Process line items into products structure
      const lineItems = processReturnLineItems(rmaData);

      log.debug('Processed Return Line Items', {
        rmaId,
        originalRowCount: rmaData.length,
        processedLineItemCount: lineItems.length,
        labelSubtotal: labelSubtotalStr,
        lineItems
      });

      // Build the payload according to the required format
      const payload = {
        emailType: 'ReturnOrderSummary',
        orderNumber: salesOrderId,
        RMAID: rmaTransactionId,
        customerFirstName,
        geo,
        email: customerEmail,
        labelSubtotal: labelSubtotalStr,
        lineItems
      };

      log.debug('Return Confirmation Payload Created', {
        rmaId,
        customerEmail,
        geo,
        lineItemCount: lineItems.length,
        totalLabelSubtotal: labelSubtotalStr,
        payload
      });

      return payload;
    } catch (e) {
      log.error('Error in processReturnConfirmationEmail', e);
      return { success: false, message: e.message };
    }
  };

  // ===== API Communication Functions =====
  /**
   * Send data to external API - simplified to single attempt
   * @param {Object} data - Data to send
   * @param {Object} apiConfigRecord - Record ID for API configuration
   * @param {string} transactionId - Transaction ID for logging
   * @return {Object} - Response from the external API
   */
  const sendToExternalAPI = (data, apiConfigRecord, transactionId) => {
    try {
      const finalURL = `${apiConfigRecord.baseUrl}${apiConfigRecord.resourcePath}`;

      const clientId = `${apiConfigRecord.clientId}`;
      const clientSecret = https.createSecureString({
        input: `{${apiConfigRecord.secretId}}`
      });
      log.debug('data', data);
      const generatedUUID = random.generateUUID();
      const secureUUID = https.createSecureString({
        input: `{${generatedUUID}}`
      });

      const response = https.post({
        url: finalURL,
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          Accept: '*/*',
          'x-correlation-id': secureUUID,
          client_id: clientId,
          client_secret: clientSecret
        }
      });

      log.audit('API Success', response);

      // send response to record
      sendResponseLogToRecord(
        apiConfigRecord.requestType,
        new Date(),
        data,
        response,
        generatedUUID,
        transactionId
      );

      return {
        status: 'Sent Payload',
        message: 'Data sent',
        response
      };
    } catch (e) {
      log.error('API Exception', e);
      return {
        status: 'error',
        message: e.message
      };
    }
  };

  /**
   * Logs API request and response data to a custom record
   * @param {string} requestType - The type of API request
   * @param {Date} timestamp - The timestamp of the request attempt
   * @param {Object} data - The request data that was sent to the API
   * @param {Object} response - The response received from the API
   * @param {string} uuid - The unique identifier for this API call
   * @param {string} transactionId - The NetSuite transaction ID associated with this request
   * @return {number} - The internal ID of the created log record
   */
  const sendResponseLogToRecord = (requestType, timestamp, data, response, uuid, transactionId) => {
    // Create the record
    const apiCallRecord = record.create({
      type: 'customrecord_bpc_bb_mulesoft_api_log',
      isDynamic: true
    });
    apiCallRecord.setValue({
      fieldId: 'custrecord_bpc_bb_msapirl_transaction',
      value: transactionId
    });
    apiCallRecord.setValue({
      fieldId: 'custrecord_bpc_bb_msapirl_request',
      value: JSON.stringify(data)
    });
    apiCallRecord.setValue({
      fieldId: 'custrecord_bpc_bb_msapirl_lst_rqst_atmpt',
      value: timestamp
    });
    apiCallRecord.setValue({
      fieldId: 'custrecord_bpc_bb_msapirl_request_type',
      value: requestType
    });
    apiCallRecord.setValue({
      fieldId: 'custrecord_bpc_bb_msapirl_response',
      value: JSON.stringify(response)
    });
    apiCallRecord.setValue({
      fieldId: 'custrecord_bpc_bb_uuid',
      value: uuid
    });

    // Save and return the record ID
    const recordId = apiCallRecord.save();
    log.debug('Response Log Created', { recordId });
    return recordId;
  };

  // ===== Return Library Functions =====
  return {
    // Configuration and constants
    SalesChannels,
    getConfigRecord,
    RequestType,

    // Core utilities
    processSuiteQL,
    convertAllValuesToStrings,

    // Data queries
    lookupFulfillmentFields,
    lookupFulfillmentFieldsFromSalesOrder,
    getSalesOrderDataForSummary,
    getSalesOrderJsonData,
    lookupReturnAuthorizationFields,

    // Validation
    hasExistingApiLog,
    isValidSalesChannel,
    allItemsShipped,
    shouldTriggerASN,
    isReadyForProcessing,

    // Data processing
    processHeaderFields,
    processLineItems,
    processSalesOrderSummaryHeaderFields,
    processSalesOrderSummaryLineItems,

    // Payload creation
    createMarketplacePayload,
    createSalesOrderSummaryPayload,
    buildFulfillmentPayload,
    createGifteePayload,

    // Main processing
    processFulfillmentForApiDelivery,
    processSalesOrderSummary,
    processReturnConfirmationEmail,

    // API communication
    sendToExternalAPI,
    sendResponseLogToRecord
  };
});