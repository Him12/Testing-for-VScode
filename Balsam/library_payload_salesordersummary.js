/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/query', 'N/log'], (query, log) => {
  'use strict';

  /**
   * Execute SuiteQL paged and return mapped results
   * @param {string} suiteQL
   * @returns {Object[]}
   */
  const processSuiteQL = (suiteQL) => {
    try {
      const pagedData = query.runSuiteQLPaged({ query: suiteQL, pageSize: 1000 });
      return pagedData.pageRanges.reduce(
        (results, _, index) => results.concat(pagedData.fetch({ index }).data.asMappedResults()),
        []
      );
    } catch (e) {
      log.error('processSuiteQL error', e);
      return [];
    }
  };

  /**
 * Get fulfillment + line details for all fulfillments related to a Sales Order.
 * Used to map cartons / UPCs and tracking back to parent SO lines.
 * @param {number|string} salesOrderId
 * @returns {Object[]}
 */
const lookupFulfillmentFieldsFromSalesOrder = (salesOrderId) => {
  if (!salesOrderId) return [];
  return processSuiteQL(`
    SELECT
      so.tranid,
      so.custbody_bpc_bb_blsm_ordercreationonp,
      so.id soid,
      so.trandate,
      so.custbody_bpc_bb_min_est_del_date as minshipdate,
      so.custbody_bpc_bb_max_est_del_date as maxshipdate,
      BUILTIN.DF(so.cseg_geo) as sogeo,
      so.email,

      -- Fulfillment details
      iff.id as fulfillmentid,
      iff.tranid as fulfillment_number,
      iff.custbody_bb_bpc_wis_shipdate_time as shipdate,
      iff.shipmethod,

      -- Fulfillment line
      ifl.id as line_item_id,
      ifl.item as itemid_internal,
      BUILTIN.DF(ifl.item) as displayname,
      ifl.quantity as quantity,
      ifl.custcol_bpc_bb_tracking_numbers,
      ifl.custcol_bb_bpc_narvar_url,
      ifl.custcol_bb_bpc_vendor_item_descriptio,
      ifl.custcol_bpc_bb_line_item_id,
      ifl.custcol_bpc_bb_vendor_sku,
      ifl.custcol_bpc_bb_shipping_carrier,
      ifl.custcol_bpc_bb_shipping_method,
      ifl.custcol_if_bol_col_weight,
      ifl.custcol_bb_bpc_parent_line_id,
      ifl.custcol_bpc_bb_upc_bundle_id,

      -- Item / UPC details (carton / child item)
      item.itemid as itemid, -- ✅ this is your carton SKU / UPC
      item.displayname as item_displayname,
      item.custitem_bpc_bb_bh_cartonnumber,
      item.custitem_bpc_bb_carton_total_count,
      item.custitem_bpc_bb_image_url as imageURL,

      -- Parent SKU
      parentitem.itemid as parent_itemid,
      parentitem.displayname as parent_displayname,

      -- Shipping address
      tsa.addressee,
      tsa.addr1,
      tsa.addr2,
      tsa.city,
      tsa.state,
      tsa.zip,
      tsa.country,
      tsa.addrphone,

      -- Location address
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
      LEFT JOIN transaction iff ON ntl.nextdoc = iff.id
      LEFT JOIN transactionline ifl ON ifl.transaction = iff.id
      LEFT JOIN transactionshippingaddress tsa ON iff.shippingaddress = tsa.nkey
      LEFT JOIN item ON ifl.item = item.id
      LEFT JOIN unitstypeuom uom ON uom.internalid = ifl.units
      LEFT JOIN item parentitem ON item.parent = parentitem.id
      LEFT JOIN location ON ifl.location = location.id
      LEFT JOIN locationmainaddress lma ON location.mainaddress = lma.nkey
    WHERE
      so.recordtype = 'salesorder'
      AND iff.recordtype = 'itemfulfillment'
      AND ifl.iscogs = 'F'
      AND ifl.itemtype <> 'ShipItem'
      AND so.id = ${salesOrderId}
  `);
};


  /**
   * Get Sales Order rows (SO header + SO lines) when no fulfillments exist (or to build parent SKU map)
   * @param {number|string} salesOrderId
   * @returns {Object[]}
   */
  const getSalesOrderDataForSummary = (salesOrderId) => {
    if (!salesOrderId) return [];
    return processSuiteQL(`
      SELECT 
        so.tranid,
        so.id as soid,
        so.trandate,
        so.custbody_bpc_bb_blsm_ordercreationonp,
        so.custbody_bpc_bb_min_est_del_date as minshipdate,
        so.custbody_bpc_bb_max_est_del_date as maxshipdate,
        so.shipdate,
        BUILTIN.DF(so.cseg_geo) as sogeo,
        so.email,

        -- Shipping address
        tsa.addressee,
        tsa.addr1,
        tsa.addr2,
        tsa.city,
        tsa.state,
        tsa.zip,
        tsa.country,
        tsa.addrphone,

        -- Sales Order line
        sol.id as line_item_id,
        sol.custcol_bpc_bb_line_item_id,
        sol.custcol_bb_bpc_parent_line_id,
        sol.item,
        sol.quantity,
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
   * Retrieve JSON stored on SO lines (for channels that store line JSON)
   * @param {number|string} salesOrderId
   * @returns {Object} map of line_item_id -> parsed JSON
   */
  const getSalesOrderJsonData = (salesOrderId) => {
    if (!salesOrderId) return {};
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

    const jsonDataMap = {};
    results.forEach((row) => {
      if (row.custcol_bpc_bb_line_item_id && row.custcol_bpc_bb_json) {
        try {
          jsonDataMap[row.custcol_bpc_bb_line_item_id] = JSON.parse(row.custcol_bpc_bb_json);
        } catch (e) {
          log.error('getSalesOrderJsonData - JSON parse error', {
            lineId: row.custcol_bpc_bb_line_item_id,
            error: e
          });
        }
      }
    });
    return jsonDataMap;
  };

  /**
   * Build header object for SalesOrderSummary payload
   * @param {Object} firstRow
   * @param {Object} apiConfig (optional)
   * @returns {Object}
   */
  const processSalesOrderSummaryHeaderFields = (firstRow, apiConfig) => {
    return {
      emailType: 'SalesOrderSummary',
      soTranId: firstRow.tranid || '',
      orderDate: firstRow.custbody_bpc_bb_blsm_ordercreationonp || firstRow.trandate || '',
      shipDate: firstRow.shipdate || '',
      geo: firstRow.sogeo || firstRow.geo || '',
      email: firstRow.email || '',
      minShipDate: firstRow.minshipdate || '',
      maxShipDate: firstRow.maxshipdate || '',
      isLtl: firstRow.custbody_bpc_contains_atleast_one_ltl || false,
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
 * Create grouped line items (parents) and attach tracking/carton info from fulfillments
 * @param {Object[]} salesOrderRows
 * @param {Object[]} fulfillmentRows
 * @returns {Object[]}
 */
const processSalesOrderSummaryLineItems = (salesOrderRows, fulfillmentRows = []) => {
  const parentMap = new Map();

  // 1. Build parent entries (SO lines without parent)
  salesOrderRows.forEach((row) => {
    if (!row.custcol_bb_bpc_parent_line_id) {
      const lineId = String(row.custcol_bpc_bb_line_item_id);
      if (!parentMap.has(lineId)) {
        parentMap.set(lineId, {
          lineItemId: lineId,
          itemId: row.parent_itemid || row.itemid || '',
          productName: row.parent_displayname || row.displayname || '',
          imageURL: row.imageurl || '',
          quantity: String(Math.abs(row.quantity || 0)), // fallback to SO qty
          trackingNumbers: []
        });
      }
    }
  });

  // 2. Attach fulfillment carton/tracking
  fulfillmentRows.forEach((row) => {
    let parentLineId = String(row.custcol_bb_bpc_parent_line_id || '');

    // 🔹 fallback: if parent_line_id is missing, match by parent SKU
    if (!parentLineId) {
      parentLineId = [...parentMap.keys()].find((id) => {
        const parent = parentMap.get(id);
        return parent.itemId === (row.parent_itemid || '');
      });
    }

    if (!parentLineId || !parentMap.has(parentLineId)) return;

    const parent = parentMap.get(parentLineId);
    const trackingEntry = {
      trackingNumber: row.custcol_bpc_bb_tracking_numbers || '',
      cartonNumber: row.custitem_bpc_bb_bh_cartonnumber || '',
      totalCartons: row.custitem_bpc_bb_carton_total_count || '',
      upc: row.itemid || '', // ✅ carton SKU / UPC from child item
      trackingNumberUrl: row.custcol_bb_bpc_narvar_url || '',
      quantity: String(Math.abs(row.quantity || 0)) // fulfilled qty
    };

    // avoid duplicates
    const exists = parent.trackingNumbers.some(
      (t) =>
        t.trackingNumber === trackingEntry.trackingNumber &&
        t.cartonNumber === trackingEntry.cartonNumber
    );
    if (!exists) parent.trackingNumbers.push(trackingEntry);
  });

  return Array.from(parentMap.values());
};


  /**
   * Create the final SalesOrderSummary payload structure
   * @param {Object} headerData
   * @param {Object[]} lineItems
   * @returns {Object}
   */
  const createSalesOrderSummaryPayload = (headerData, lineItems) => {
    return {
      emailType: 'SalesOrderSummary',
      orderNumber: headerData.soTranId,
      orderDate: headerData.orderDate,
      shipDate: headerData.shipDate || '',
      geo: headerData.geo,
      maxShipDate: headerData.maxShipDate || '',
      minShipDate: headerData.minShipDate || '',
      email: headerData.email,
      isLtl: headerData.isLtl || false,
      lineItems: (lineItems || []).map((item) => ({
        itemId: item.itemId,
        productName: item.productName,
        quantity: item.quantity || '',
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

  // Public exports
  return {
    processSuiteQL,
    lookupFulfillmentFieldsFromSalesOrder,
    getSalesOrderDataForSummary,
    getSalesOrderJsonData,
    processSalesOrderSummaryHeaderFields,
    processSalesOrderSummaryLineItems,
    createSalesOrderSummaryPayload
  };
});
