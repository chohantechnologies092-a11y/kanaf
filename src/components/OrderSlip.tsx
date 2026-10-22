import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ticket } from '../store/restaurantStore';
import SultanLogo from './SultanLogo';
import { SULTAN_LOGO_BASE64 } from '../constants/logoBase64';

type OrderSlipProps = {
  ticket: Ticket;
};

/**
 * Universal print helper for Kitchen / JuiceBar Order Slips.
 */
export function printOrderSlip(ticket: Ticket) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const date = new Date(ticket.timePlaced).toLocaleString();
  const itemsHtml = ticket.items.map(item => `
    <tr>
      <td style="width: 16%; font-size: 13px; font-weight: bold; vertical-align: top; padding: 4px 0;">${item.qty}x</td>
      <td style="width: 84%; font-size: 13px; vertical-align: top; padding: 4px 0;">
        <div style="font-weight: bold;">${item.name}</div>
        ${item.notes ? `<div style="font-size: 10px; font-style: italic; color: #666; margin-top: 1px;">Note: ${item.notes}</div>` : ''}
      </td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Kitchen Ticket #${ticket.id} - Kanaf Cafe & Bakery</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: 80mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0 auto;
          padding: 6mm 4mm;
          width: 78mm;
          max-width: 80mm;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", Courier, monospace;
          color: #000;
          background: #fff;
          font-size: 11px;
        }
        .header {
          text-align: center;
          margin-bottom: 6px;
        }
        .logo-img {
          width: 50px;
          height: 46px;
          object-fit: contain;
          margin: 0 auto 4px auto;
          display: block;
        }
        .logo-title {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 2px;
          margin: 0;
          color: #111;
        }
        .logo-sub {
          font-size: 11px;
          font-weight: 700;
          color: #555;
          letter-spacing: 1px;
          margin-top: 2px;
        }
        .divider {
          border-top: 2px solid #000;
          margin: 6px 0;
        }
        .divider-dashed {
          border-top: 1px dashed #666;
          margin: 6px 0;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin: 2px 0;
          font-family: "Courier New", Courier, monospace;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 6px 0;
          font-family: "Courier New", Courier, monospace;
        }
        th {
          font-size: 11px;
          text-transform: uppercase;
          border-bottom: 1px solid #000;
          padding: 4px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${SULTAN_LOGO_BASE64}" alt="Kanaf Logo" class="logo-img" />
        <h2 class="logo-title">KITCHEN SLIP</h2>
        <div class="logo-sub">${ticket.isAddOn ? 'ADD-ON ORDER' : 'NEW ORDER'}</div>
      </div>
      <div class="divider"></div>
      <div class="meta-row">
        <span>Ticket #: ${ticket.id}</span>
        <span>${date}</span>
      </div>
      <div class="meta-row" style="font-size: 13px; font-weight: bold;">
        <span>Table: ${ticket.tableName}</span>
        <span>Server: ${ticket.server}</span>
      </div>
      ${ticket.isAddOn ? `<div class="meta-row"><span>Round #: ${ticket.roundNumber}</span></div>` : ''}
      <div class="divider-dashed"></div>
      <table>
        <thead>
          <tr>
            <th style="width: 16%; text-align: left;">Qty</th>
            <th style="width: 84%; text-align: left;">Item</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="divider"></div>
    </body>
    </html>
  `;

  let iframe = document.getElementById('slip-print-frame') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'slip-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    }, 250);
  }
}

export default function OrderSlip({ ticket }: OrderSlipProps) {
  const date = new Date(ticket.timePlaced).toLocaleString();

  return (
    <View style={styles.container} nativeID="order-slip-container">
      {Platform.OS === 'web' && (
        <style type="text/css">
          {`
            @media print {
              body * {
                visibility: hidden;
              }
              #order-slip-container, #order-slip-container * {
                visibility: visible;
              }
              #order-slip-container {
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                top: 0;
                width: 80mm;
                max-width: 80mm;
                margin: 0 auto;
                padding: 6mm 4mm;
                background: #fff;
              }
            }
          `}
        </style>
      )}
      {/* Header */}
      <View style={styles.header}>
        <SultanLogo size="sm" variant="bare" width={44} height={42} style={{ alignSelf: 'center', marginBottom: 4 }} />
        <Text style={styles.logoText}>KITCHEN SLIP</Text>
        <Text style={styles.logoSubText}>{ticket.isAddOn ? 'ADD-ON ORDER' : 'NEW ORDER'}</Text>
      </View>

      <View style={styles.divider} />

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Ticket #: {ticket.id}</Text>
        <Text style={styles.metaText}>{date}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaTextBold}>Table: {ticket.tableName}</Text>
        <Text style={styles.metaText}>Server: {ticket.server}</Text>
      </View>
      {ticket.isAddOn && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Round #: {ticket.roundNumber}</Text>
        </View>
      )}

      <View style={styles.dividerDashed} />

      {/* Items */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableText, styles.qtyCol]}>Qty</Text>
        <Text style={[styles.tableText, styles.itemCol]}>Item</Text>
      </View>

      {ticket.items.map((item, idx) => (
        <View key={idx} style={styles.tableRow}>
          <Text style={[styles.itemText, styles.qtyCol, { fontWeight: 'bold' }]}>{item.qty}</Text>
          <View style={styles.itemCol}>
            <Text style={styles.itemText}>{item.name}</Text>
            {item.notes ? (
              <Text style={styles.notesText}>Note: {item.notes}</Text>
            ) : null}
          </View>
        </View>
      ))}

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 2,
  },
  logoSubText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: 1,
    marginTop: 2,
  },
  divider: {
    height: 2,
    backgroundColor: '#000',
    marginVertical: 8,
  },
  dividerDashed: {
    height: 1,
    borderWidth: 1,
    borderColor: '#666',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  metaTextBold: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  tableText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  itemText: {
    fontSize: 12,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  notesText: {
    fontSize: 10,
    color: '#e67e22',
    fontStyle: 'italic',
    marginTop: 2,
  },
  qtyCol: {
    width: '18%',
  },
  itemCol: {
    width: '82%',
  },
});
