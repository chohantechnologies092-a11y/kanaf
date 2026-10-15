import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, TouchableOpacity, Share, Alert, Image, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Invoice, useRestaurantStore } from '../store/restaurantStore';
import SultanLogo from './SultanLogo';
import { SULTAN_LOGO_BASE64 } from '../constants/logoBase64';
import { generateInvoiceQrCode, getInvoiceFeedbackUrl } from '../utils/qrCode';

type InvoiceProps = {
  invoice: Invoice;
  onClose?: () => void;
};

/**
 * Universal responsive print engine for Sultan Restaurant receipt slip.
 * Responsive for any printer:
 * - On 80mm / 58mm Thermal Printers: Fits 100% of the roll width with compact thermal typography.
 * - On A4 / Letter Printers (EPSON L300, HP, Save as PDF): Automatically expands to fill the A4 page width
 *   with high-impact 130px logo, spacious 14.5px typography, and clean wide itemized rows!
 * - Includes scannable QR Code linking to customer item-wise feedback portal.
 */
export async function printInvoiceReceipt(invoice: Invoice, precomputedQrCode?: string) {
  const qrCodeDataUrl = precomputedQrCode || await generateInvoiceQrCode(invoice.id);
  const feedbackUrl = getInvoiceFeedbackUrl(invoice.id);

  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    const dateStr = new Date(invoice.timeSettled || invoice.timePlaced).toLocaleString();
    const orderCreator = invoice.orderTakenBy || (invoice.server && !invoice.server.toLowerCase().includes('pos') ? invoice.server : 'Staff');
    const cashierName = invoice.cashier || (invoice.server?.toLowerCase().includes('pos') ? invoice.server : 'Manager');
    
    let text = `================================\n`;
    text += `       SULTAN RESTAURANT       \n`;
    text += `    LUXURY DINING & BANQUET    \n`;
    text += `Food Street, Culinary District, Lahore\n`;
    text += ` Tel: 0300-1234567 • NTN: 8943120-4\n`;
    text += `--------------------------------\n`;
    text += `INV #: ${invoice.id}\n`;
    text += `Date: ${dateStr}\n`;
    text += `Type: ${invoice.orderType.toUpperCase()}${invoice.tableName ? ` • Table: ${invoice.tableName}` : ''}\n`;
    text += `Order Taken By: ${orderCreator}\n`;
    text += `Billed By (Cashier): ${cashierName}\n`;
    text += `--------------------------------\n`;
    text += `Qty  Item               Amount\n`;
    text += `--------------------------------\n`;
    invoice.items.forEach(i => {
      text += `${i.qty}x  ${i.name.padEnd(18).substring(0, 18)} Rs. ${(i.price * i.qty).toLocaleString()}\n`;
    });
    text += `--------------------------------\n`;
    text += `Sub Total: Rs. ${(invoice.subTotal || 0).toLocaleString()}\n`;
    if ((invoice.discount || 0) > 0) {
      text += `Discount: - Rs. ${(invoice.discount || 0).toLocaleString()}\n`;
    }
    text += `GST Tax (16%): Rs. ${(invoice.tax || 0).toLocaleString()}\n`;
    text += `================================\n`;
    text += `NET PAYABLE: Rs. ${(invoice.total || 0).toLocaleString()}\n`;
    text += `================================\n`;
    if (invoice.payments && invoice.payments.length > 0) {
      invoice.payments.forEach(p => {
        text += `Paid via ${p.type.toUpperCase()}: Rs. ${(p.amount || 0).toLocaleString()}\n`;
      });
    }
    text += `\nRate Each Dish & Give Feedback:\n${feedbackUrl}\n`;
    text += `\nThank you for dining with Sultan!\n`;

    try {
      Share.share({ message: text, title: `Invoice #${invoice.id}` });
    } catch {
      Alert.alert('Invoice', text);
    }
    return;
  }

  // Web Printing Implementation via Isolated IFrame
  const dateStr = new Date(invoice.timeSettled || invoice.timePlaced).toLocaleDateString();
  const timeStr = new Date(invoice.timeSettled || invoice.timePlaced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const orderCreator = invoice.orderTakenBy || (invoice.server && !invoice.server.toLowerCase().includes('pos') ? invoice.server : 'Staff');
  const cashierName = invoice.cashier || (invoice.server?.toLowerCase().includes('pos') ? invoice.server : 'Manager');
  const isSameStaff = orderCreator === cashierName;

  const itemsHtml = invoice.items.map(item => `
    <tr>
      <td class="col-qty" style="width: 14%; vertical-align: top; font-weight: bold;">${item.qty}x</td>
      <td class="col-item" style="width: 54%; vertical-align: top; word-break: break-word;">${item.name}</td>
      <td class="col-amount" style="width: 32%; vertical-align: top; text-align: right; font-weight: bold;">${(item.price * item.qty).toLocaleString()}</td>
    </tr>
  `).join('');

  const paymentsHtml = (invoice.payments && invoice.payments.length > 0)
    ? invoice.payments.map(p => `
      <div class="summary-row">
        <span>Paid via ${p.type.toUpperCase()}:</span>
        <span style="font-weight: bold;">Rs. ${(p.amount || 0).toLocaleString()}</span>
      </div>
    `).join('')
    : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt #${invoice.id} - Sultan Restaurant</title>
      <style>
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #111111;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", Courier, monospace;
        }

        .header {
          text-align: center;
        }

        .logo-img {
          object-fit: contain;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }

        .brand-title {
          font-weight: 900;
          color: #1C1C1E;
          margin: 0;
          text-align: center;
        }

        .brand-sub {
          font-weight: 700;
          color: #666666;
          text-align: center;
        }

        .contact {
          color: #555555;
          text-align: center;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          font-family: "Courier New", Courier, monospace;
        }

        .meta-bold {
          font-weight: bold;
          color: #000000;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-family: "Courier New", Courier, monospace;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-family: "Courier New", Courier, monospace;
        }

        .grand-row {
          display: flex;
          justify-content: space-between;
          font-family: "Courier New", Courier, monospace;
        }

        .footer {
          text-align: center;
        }

        /* ========================================================
           1. SMALL THERMAL PRINTER (Paper width <= 110mm: 80mm or 58mm)
           ======================================================== */
        @media print and (max-width: 110mm) {
          @page {
            size: auto;
            margin: 2mm auto;
          }
          body {
            width: 100% !important;
            max-width: 80mm !important;
            padding: 4mm 3mm !important;
            font-size: 11.5px !important;
            line-height: 1.35 !important;
            margin: 0 auto !important;
          }
          .logo-img {
            width: 80px !important;
            height: 74px !important;
            margin-bottom: 4px !important;
          }
          .brand-title {
            font-size: 19px !important;
            letter-spacing: 2px !important;
          }
          .brand-sub, .contact {
            font-size: 9.5px !important;
            margin-top: 2px !important;
          }
          .dashed-line {
            border-top: 1px dashed #777 !important;
            margin: 6px 0 !important;
          }
          .double-line {
            border-top: 2px solid #222 !important;
            margin: 6px 0 !important;
          }
          .meta-row {
            font-size: 11px !important;
            margin: 2.5px 0 !important;
          }
          table {
            margin: 5px 0 !important;
          }
          table th {
            font-size: 11.5px !important;
            text-transform: uppercase !important;
            border-bottom: 1px solid #aaa !important;
            padding: 4px 0 !important;
          }
          table td {
            font-size: 11.5px !important;
            padding: 3px 0 !important;
          }
          .summary-row {
            font-size: 11.5px !important;
            margin: 2.5px 0 !important;
          }
          .grand-row {
            font-size: 15px !important;
            font-weight: 900 !important;
            margin: 4px 0 !important;
          }
          .footer {
            margin-top: 12px !important;
            padding-top: 8px !important;
            border-top: 1px solid #eee !important;
            font-size: 10px !important;
            color: #444 !important;
          }
          .qr-section {
            text-align: center !important;
            margin: 6px 0 !important;
            padding: 4px 0 !important;
          }
          .qr-section-title {
            font-size: 10px !important;
            font-weight: 800 !important;
            letter-spacing: 1px !important;
            color: #111 !important;
            margin-bottom: 3px !important;
          }
          .qr-code-img {
            width: 96px !important;
            height: 96px !important;
            display: block !important;
            margin: 0 auto !important;
          }
          .qr-hint {
            font-size: 8.5px !important;
            color: #444 !important;
            margin-top: 3px !important;
          }
          .qr-url-text {
            font-size: 7.5px !important;
            color: #777 !important;
            margin-top: 1px !important;
            word-break: break-all !important;
          }
        }

        /* ========================================================
           2. STANDARD A4 / LETTER PRINTER (Paper width > 110mm: EPSON L300, HP, A4)
           ======================================================== */
        @media print and (min-width: 111mm) {
          @page {
            size: A4 portrait;
            margin: 10mm 15mm;
          }
          body {
            width: 100% !important;
            max-width: 180mm !important;
            margin: 0 auto !important;
            padding: 4mm 0 !important;
            font-size: 14.5px !important;
            line-height: 1.55 !important;
          }
          .logo-img {
            width: 130px !important;
            height: 120px !important;
            margin-bottom: 8px !important;
          }
          .brand-title {
            font-size: 28px !important;
            letter-spacing: 3px !important;
            margin-bottom: 4px !important;
          }
          .brand-sub {
            font-size: 13px !important;
            letter-spacing: 2px !important;
            margin-top: 3px !important;
          }
          .contact {
            font-size: 12.5px !important;
            margin-top: 4px !important;
          }
          .dashed-line {
            border-top: 1.5px dashed #555 !important;
            margin: 12px 0 !important;
          }
          .double-line {
            border-top: 2.5px solid #111 !important;
            margin: 12px 0 !important;
          }
          .meta-row {
            font-size: 14px !important;
            margin: 5px 0 !important;
          }
          table {
            margin: 14px 0 !important;
          }
          table th {
            font-size: 14px !important;
            text-transform: uppercase !important;
            border-bottom: 2px solid #333 !important;
            padding: 8px 4px !important;
          }
          table td {
            font-size: 14px !important;
            padding: 7px 4px !important;
            border-bottom: 1px solid #f0f0f0 !important;
          }
          .summary-row {
            font-size: 14.5px !important;
            margin: 6px 0 !important;
          }
          .grand-row {
            font-size: 20px !important;
            font-weight: 900 !important;
            margin: 10px 0 !important;
          }
          .footer {
            margin-top: 24px !important;
            padding-top: 14px !important;
            border-top: 1.5px solid #ddd !important;
            font-size: 13px !important;
            color: #444 !important;
          }
          .qr-section {
            text-align: center !important;
            margin: 14px 0 !important;
            padding: 8px 0 !important;
          }
          .qr-section-title {
            font-size: 14px !important;
            font-weight: 800 !important;
            letter-spacing: 2px !important;
            color: #111 !important;
            margin-bottom: 6px !important;
          }
          .qr-code-img {
            width: 130px !important;
            height: 130px !important;
            display: block !important;
            margin: 0 auto !important;
          }
          .qr-hint {
            font-size: 12px !important;
            color: #333 !important;
            margin-top: 5px !important;
          }
          .qr-url-text {
            font-size: 10.5px !important;
            color: #666 !important;
            margin-top: 2px !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${SULTAN_LOGO_BASE64}" alt="Sultan Logo" class="logo-img" />
        <h1 class="brand-title">SULTAN RESTAURANT</h1>
        <div class="brand-sub">LUXURY DINING & BANQUET</div>
        <div class="contact">Food Street, Culinary District, Lahore</div>
        <div class="contact">Tel: 0300-1234567 • NTN: 8943120-4</div>
      </div>

      <div class="dashed-line"></div>

      <div class="meta-row">
        <span>INV: #${invoice.id}</span>
        <span>${timeStr}</span>
      </div>
      <div class="meta-row">
        <span>Type: ${invoice.orderType.toUpperCase()}</span>
        <span>Date: ${dateStr}</span>
      </div>
      ${invoice.tableName ? `<div class="meta-row"><span>Table: ${invoice.tableName}</span></div>` : ''}

      ${isSameStaff ? `
        <div class="meta-row"><span>Staff / Cashier: ${cashierName}</span></div>
      ` : `
        <div class="meta-row">
          <span>Order Taken By:</span>
          <span class="meta-bold">${orderCreator}</span>
        </div>
        <div class="meta-row">
          <span>Billed By (Cashier):</span>
          <span class="meta-bold">${cashierName}</span>
        </div>
      `}

      ${invoice.customer ? `
        <div class="meta-row"><span>Guest: ${invoice.customer.name}</span></div>
        <div class="meta-row"><span>Phone: ${invoice.customer.phone}</span></div>
        ${invoice.customer.address ? `<div class="meta-row"><span>Address: ${invoice.customer.address}</span></div>` : ''}
      ` : ''}

      ${invoice.status === 'voided' ? `
        <div style="text-align: center; color: #c62828; font-weight: bold; font-size: 12px; margin: 8px 0;">
          *** BILL VOIDED / CANCELLED ***
        </div>
      ` : ''}

      <div class="dashed-line"></div>

      <table>
        <thead>
          <tr>
            <th style="width: 14%; text-align: left;">Qty</th>
            <th style="width: 54%; text-align: left;">Item</th>
            <th style="width: 32%; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="dashed-line"></div>

      <div class="summary-row">
        <span>Sub Total:</span>
        <span style="font-weight: bold;">Rs. ${(invoice.subTotal || 0).toLocaleString()}</span>
      </div>
      ${(invoice.discount || 0) > 0 ? `
        <div class="summary-row">
          <span>Discount:</span>
          <span style="font-weight: bold;">- Rs. ${(invoice.discount || 0).toLocaleString()}</span>
        </div>
      ` : ''}
      <div class="summary-row">
        <span>GST Tax (16%):</span>
        <span style="font-weight: bold;">Rs. ${(invoice.tax || 0).toLocaleString()}</span>
      </div>

      <div class="double-line"></div>

      <div class="grand-row">
        <span>NET PAYABLE:</span>
        <span>Rs. ${(invoice.total || 0).toLocaleString()}</span>
      </div>

      <div class="double-line"></div>

      ${paymentsHtml}

      <div class="dashed-line"></div>

      <!-- Scannable Item-Wise Feedback QR Code -->
      <div class="qr-section">
        <div class="qr-section-title">SCAN FOR ITEM-WISE FEEDBACK</div>
        ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="Dish Review QR Code" class="qr-code-img" />` : ''}
        <div class="qr-hint">Rate each dish & earn 50 Sultan Loyalty Points!</div>
        <div class="qr-url-text">${feedbackUrl}</div>
      </div>

      <div class="footer">
        <div style="font-weight: bold; margin-bottom: 2px;">Thank you for dining with Sultan!</div>
        <div style="color: #666; margin-top: 2px;">We look forward to serving you again.</div>
        <div style="color: #888; font-size: 85%; margin-top: 3px;">Software by Sultan POS System</div>
      </div>
    </body>
    </html>
  `;

  let iframe = document.getElementById('receipt-print-frame') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-frame';
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

export default function InvoiceComponent({ invoice }: InvoiceProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 420;

  const onlineFeedbackUrl = useRestaurantStore((state) => state.onlineFeedbackUrl);
  const setOnlineFeedbackUrl = useRestaurantStore((state) => state.setOnlineFeedbackUrl);

  // Automatically purge dropped/dead tunnels and 404 placeholders from store/state
  const effectiveOnlineUrl = (!onlineFeedbackUrl || onlineFeedbackUrl.includes('sultan-resturant.web.app') || onlineFeedbackUrl.includes('.lhr.life'))
    ? 'http://192.168.1.17:8081'
    : onlineFeedbackUrl;

  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>('');
  const [activeFeedbackUrl, setActiveFeedbackUrl] = React.useState<string>('');
  const [domainModalVisible, setDomainModalVisible] = React.useState<boolean>(false);
  const [customDomainInput, setCustomDomainInput] = React.useState<string>(effectiveOnlineUrl);

  React.useEffect(() => {
    if (!onlineFeedbackUrl || onlineFeedbackUrl.includes('sultan-resturant.web.app') || onlineFeedbackUrl.includes('.lhr.life')) {
      const stableUrl = 'http://192.168.1.17:8081';
      setOnlineFeedbackUrl(stableUrl);
      setCustomDomainInput(stableUrl);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('sultan_feedback_online_url');
        } catch {
          // Ignore
        }
      }
    }
  }, [onlineFeedbackUrl, setOnlineFeedbackUrl]);

  React.useEffect(() => {
    let isMounted = true;
    const resolvedUrl = getInvoiceFeedbackUrl(invoice.id, effectiveOnlineUrl);
    setActiveFeedbackUrl(resolvedUrl);

    generateInvoiceQrCode(invoice.id, effectiveOnlineUrl).then(url => {
      if (isMounted) setQrCodeDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [invoice.id, effectiveOnlineUrl]);

  const dateStr = new Date(invoice.timeSettled || invoice.timePlaced).toLocaleDateString();
  const timeStr = new Date(invoice.timeSettled || invoice.timePlaced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const orderCreator = invoice.orderTakenBy || (invoice.server && !invoice.server.toLowerCase().includes('pos') ? invoice.server : 'Staff');
  const cashierName = invoice.cashier || (invoice.server?.toLowerCase().includes('pos') ? invoice.server : 'Manager');
  const isSameStaff = orderCreator === cashierName;

  const handleSaveDomain = () => {
    if (customDomainInput.trim()) {
      const clean = customDomainInput.trim().replace(/\/+$/, '');
      setOnlineFeedbackUrl(clean);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('sultan_feedback_online_url', clean);
        } catch {
          // Ignore
        }
      }
    }
    setDomainModalVisible(false);
  };

  return (
    <View style={styles.outerWrapper}>
      {/* RESTAURANT RECEIPT SLIP */}
      <View nativeID="standard-invoice-receipt" style={styles.container}>
        {/* Header with Big Logo */}
        <View style={styles.header}>
          <SultanLogo size="md" variant="bare" width={86} height={80} style={{ alignSelf: 'center', marginBottom: 6 }} />
          <Text style={[styles.brandTitle, isSmall && { fontSize: 17 }]}>SULTAN RESTAURANT</Text>
          <Text style={styles.brandSub}>LUXURY DINING & BANQUET</Text>
          <Text style={styles.contactText}>Food Street, Culinary District, Lahore</Text>
          <Text style={styles.contactText}>Tel: 0300-1234567 • NTN: 8943120-4</Text>
        </View>

        <Text style={styles.dashedLine}>- - - - - - - - - - - - - - - - - - - - - -</Text>

        {/* Meta Info */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>INV: #{invoice.id}</Text>
          <Text style={styles.metaText}>{timeStr}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Type: {invoice.orderType.toUpperCase()}</Text>
          <Text style={styles.metaText}>Date: {dateStr}</Text>
        </View>
        {invoice.tableName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Table: {invoice.tableName}</Text>
          </View>
        ) : null}

        {/* Order Creator & Cashier Details */}
        {isSameStaff ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Staff / Cashier: {cashierName}</Text>
          </View>
        ) : (
          <>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Order Taken By:</Text>
              <Text style={[styles.metaText, styles.boldText]}>{orderCreator}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Billed By (Cashier):</Text>
              <Text style={[styles.metaText, styles.boldText]}>{cashierName}</Text>
            </View>
          </>
        )}

        {invoice.customer && (
          <View style={{ marginTop: 2 }}>
            <Text style={styles.metaText}>Guest: {invoice.customer.name}</Text>
            <Text style={styles.metaText}>Phone: {invoice.customer.phone}</Text>
            {invoice.customer.address ? (
              <Text style={styles.metaText}>Address: {invoice.customer.address}</Text>
            ) : null}
          </View>
        )}

        {invoice.status === 'voided' && (
          <View style={{ marginVertical: 6, alignItems: 'center' }}>
            <Text style={styles.voidNotice}>*** BILL VOIDED / CANCELLED ***</Text>
          </View>
        )}

        <Text style={styles.dashedLine}>- - - - - - - - - - - - - - - - - - - - - -</Text>

        {/* Items Header */}
        <View style={styles.itemHeader}>
          <Text style={[styles.colText, { width: '15%', fontWeight: 'bold' }]}>Qty</Text>
          <Text style={[styles.colText, { width: '53%', fontWeight: 'bold' }]}>Item</Text>
          <Text style={[styles.colText, { width: '32%', textAlign: 'right', fontWeight: 'bold' }]}>Amount</Text>
        </View>

        {invoice.items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={[styles.colText, { width: '15%', fontWeight: 'bold' }]}>{item.qty}x</Text>
            <Text style={[styles.colText, { width: '53%' }]}>{item.name}</Text>
            <Text style={[styles.colText, { width: '32%', textAlign: 'right', fontWeight: 'bold' }]}>
              {(item.price * item.qty).toLocaleString()}
            </Text>
          </View>
        ))}

        <Text style={styles.dashedLine}>- - - - - - - - - - - - - - - - - - - - - -</Text>

        {/* Totals */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Sub Total:</Text>
          <Text style={styles.summaryVal}>Rs. {(invoice.subTotal || 0).toLocaleString()}</Text>
        </View>
        {(invoice.discount || 0) > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Discount:</Text>
            <Text style={styles.summaryVal}>- Rs. {(invoice.discount || 0).toLocaleString()}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>GST Tax (16%):</Text>
          <Text style={styles.summaryVal}>Rs. ${(invoice.tax || 0).toLocaleString()}</Text>
        </View>

        <Text style={styles.dashedLine}>================================</Text>

        <View style={styles.grandRow}>
          <Text style={styles.grandKey}>NET PAYABLE:</Text>
          <Text style={styles.grandVal}>Rs. {(invoice.total || 0).toLocaleString()}</Text>
        </View>

        <Text style={styles.dashedLine}>================================</Text>

        {invoice.payments && invoice.payments.length > 0 && (
          invoice.payments.map((p, idx) => (
            <View key={idx} style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Paid via {p.type.toUpperCase()}:</Text>
              <Text style={styles.summaryVal}>Rs. {(p.amount || 0).toLocaleString()}</Text>
            </View>
          ))
        )}

        <Text style={styles.dashedLine}>- - - - - - - - - - - - - - - - - - - - - -</Text>

        {/* QR Code Section on Receipt */}
        <View style={styles.qrContainer}>
          <View style={styles.qrHeader}>
            <Ionicons name="qr-code" size={16} color="#D5A943" style={{ marginRight: 6 }} />
            <Text style={styles.qrHeaderText}>SCAN FOR ITEM-WISE FEEDBACK</Text>
          </View>
          {qrCodeDataUrl ? (
            <Image
              source={{ uri: qrCodeDataUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code-outline" size={48} color="#D5A943" />
            </View>
          )}

          <Text style={styles.qrSubText}>
            Scan with your mobile camera to rate each dish & earn +50 Loyalty Points!
          </Text>

          {/* Scannable URL Pill */}
          <View style={styles.qrUrlPill}>
            <Ionicons name="globe-outline" size={12} color="#15803D" style={{ marginRight: 4 }} />
            <Text style={styles.qrUrlPillText} numberOfLines={1}>
              {activeFeedbackUrl}
            </Text>
          </View>

          {/* Quick Domain Settings Button */}
          <TouchableOpacity
            style={styles.qrConfigBtn}
            onPress={() => {
              setCustomDomainInput(onlineFeedbackUrl || 'http://192.168.1.17:8081');
              setDomainModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={12} color="#475569" style={{ marginRight: 4 }} />
            <Text style={styles.qrConfigBtnText}>Configure Online / Wi-Fi QR Link</Text>
          </TouchableOpacity>

          {invoice.feedbackSubmitted || invoice.feedback ? (
            <View style={styles.feedbackBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#2E7D32" style={{ marginRight: 4 }} />
              <Text style={styles.feedbackBadgeText}>
                Feedback Submitted (⭐ {invoice.feedback?.overallRating || 5}/5)
              </Text>
            </View>
          ) : null}

          {/* Direct Interactive Feedback Link */}
          <TouchableOpacity
            style={styles.rateDishesBtn}
            onPress={() => router.push(`/feedback?invoiceId=${encodeURIComponent(invoice.id)}` as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={14} color="#4a121a" style={{ marginRight: 6 }} />
            <Text style={styles.rateDishesBtnText}>Rate Dishes & Leave Feedback</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for dining with Sultan!</Text>
          <Text style={styles.footerSub}>We look forward to serving you again.</Text>
          <Text style={styles.footerSub}>Software by Sultan POS System</Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.printActionBtn}
          onPress={() => printInvoiceReceipt(invoice, qrCodeDataUrl)}
          activeOpacity={0.8}
        >
          <Ionicons name="print" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.printActionText}>Print Receipt (with QR)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.feedbackDirectBtn}
          onPress={() => router.push(`/feedback?invoiceId=${encodeURIComponent(invoice.id)}` as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.printActionText}>Feedback Form</Text>
        </TouchableOpacity>
      </View>

      {/* Domain / Link Configuration Modal */}
      <Modal visible={domainModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.domainModalCard}>
            <View style={styles.domainModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="globe" size={20} color="#D5A943" />
                <Text style={styles.domainModalTitle}>Online QR Code & Link Settings</Text>
              </View>
              <TouchableOpacity onPress={() => setDomainModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.domainModalDesc}>
              Select or type the web address embedded into invoice QR codes so customers can scan it from their mobile cameras:
            </Text>

            <Text style={styles.domainFieldLabel}>Quick One-Tap Presets:</Text>
            <View style={styles.presetOptionsRow}>
              <TouchableOpacity
                style={[
                  styles.presetPill,
                  customDomainInput.includes('192.168.1.17') && styles.presetPillActive,
                ]}
                onPress={() => setCustomDomainInput('http://192.168.1.17:8081')}
                activeOpacity={0.7}
              >
                <Ionicons name="wifi" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.presetPillTitle}>Restaurant Wi-Fi (Instant & Permanent)</Text>
                  <Text style={styles.presetPillSub}>http://192.168.1.17:8081</Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.domainFieldLabel}>Custom Domain / Ngrok / Tunnel URL:</Text>
            <TextInput
              style={styles.domainTextInput}
              value={customDomainInput}
              onChangeText={setCustomDomainInput}
              placeholder="e.g. https://my-domain.com or https://xxxx.ngrok-free.app"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.domainModalFooter}>
              <TouchableOpacity
                style={styles.domainCancelBtn}
                onPress={() => setDomainModalVisible(false)}
              >
                <Text style={styles.domainCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.domainSaveBtn}
                onPress={handleSaveDomain}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.domainSaveBtnText}>Save & Update QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  container: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 420,
    minWidth: 300,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: 2,
    textAlign: 'center',
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  contactText: {
    fontSize: 10,
    color: '#636366',
    textAlign: 'center',
    marginTop: 2,
  },
  dashedLine: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
    marginVertical: 4,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2.5,
  },
  metaText: {
    fontSize: 11.5,
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  boldText: {
    fontWeight: 'bold',
  },
  voidNotice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#C62828',
    letterSpacing: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  itemRow: {
    flexDirection: 'row',
    marginVertical: 2.5,
  },
  colText: {
    fontSize: 11.5,
    color: '#222222',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2.5,
  },
  summaryKey: {
    fontSize: 11.5,
    color: '#444444',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  summaryVal: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#222222',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  grandKey: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  grandVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111111',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAF9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qrHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#140306',
    letterSpacing: 1,
  },
  qrImage: {
    width: 120,
    height: 120,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 4,
    backgroundColor: '#F3E8D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrSubText: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  feedbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  feedbackBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D32',
  },
  rateDishesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5E6BE',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D5A943',
  },
  rateDishesBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a121a',
  },
  footer: {
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
  },
  footerSub: {
    fontSize: 9,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 3,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  printActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a121a',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  printActionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  qrUrlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 6,
    maxWidth: '100%',
  },
  qrUrlPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  qrConfigBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  domainModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  domainModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  domainModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  domainModalDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  domainFieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  presetOptionsRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 14,
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  presetPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7',
  },
  presetPillTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  presetPillSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  domainTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  domainModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  domainCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  domainCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  domainSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#140306',
    borderWidth: 1,
    borderColor: '#D5A943',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  domainSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
