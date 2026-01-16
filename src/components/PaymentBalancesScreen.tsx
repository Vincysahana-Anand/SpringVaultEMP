import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, BackHandler, RefreshControl, TextInput, Modal, Pressable, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getCustomers, Customer, updateCustomer } from '../services/customerService';
import { addPurchaseHistory, getCustomerPurchaseHistory, PurchaseRecord } from '../services/purchaseHistoryService';
import { addDailyRecord, DailyRecordEntry } from '../services/dailyRecordService';
import { updateSalesRecord } from '../services/salesService';
import { getISTDate } from '../utils/dateUtils';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import CustomerDetailsScreen from './CustomerDetailsScreen';
import PaymentHistoryScreen from './PaymentHistoryScreen';
import RNPrint from 'react-native-print';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';

interface Props { onBack?: () => void; }

export default function PaymentBalancesScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<'cash' | 'online'>('cash');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [billingFilter, setBillingFilter] = useState<'all' | 'cash' | 'monthly'>('all');
  const [showBillingFilterModal, setShowBillingFilterModal] = useState(false);

  const [billCustomer, setBillCustomer] = useState<Customer | null>(null);
  const [billPurchases, setBillPurchases] = useState<PurchaseRecord[]>([]);
  const [billMonthOptions, setBillMonthOptions] = useState<Array<{ key: string; label: string; start: Date; end: Date }>>([]);
  const [billSelectedMonthKey, setBillSelectedMonthKey] = useState<string | null>(null);
  const [showBillOptionsModal, setShowBillOptionsModal] = useState(false);

  const [printJob, setPrintJob] = useState<
    | null
    | {
        customer: Customer;
        records: PurchaseRecord[];
      }
  >(null);
  const [printingBill, setPrintingBill] = useState(false);
  const [receiptBannerLoaded, setReceiptBannerLoaded] = useState(false);
  const [receiptLaidOut, setReceiptLaidOut] = useState(false);
  const [shareBannerDataUri, setShareBannerDataUri] = useState<string | null>(null);
  const receiptRef = useRef<ViewShot | null>(null);

  const bannerImage = useMemo(() => require('../assets/banner.png'), []);
  const shareBannerImage = useMemo(() => require('../assets/banner.jpg'), []);
  const bannerSource = useMemo(() => {
    const resolved = Image.resolveAssetSource(bannerImage as any);
    const uri = resolved?.uri;
    return uri ? ({ uri } as any) : (bannerImage as any);
  }, [bannerImage]);
  // For ViewShot capture, prefer the bundled require(...) directly. Some Android builds
  // can render an empty space when using a resolved { uri } source.
  const shareBannerSource = shareBannerImage as any;

  const getShareBannerDataUri = async (): Promise<string | null> => {
    try {
      const resolved = Image.resolveAssetSource(shareBannerImage as any);
      const uri = resolved?.uri;
      if (!uri) return null;

      const resp = await fetch(uri);
      const blob = await resp.blob();
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return dataUri || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showPayModal) {
        setShowPayModal(false);
        return true;
      }
      if (selectedCustomer) {
        setSelectedCustomer(null);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onBack, selectedCustomer, showPayModal]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getCustomers();
      if (Array.isArray(res)) {
        const normalized = res
          .map(c => ({ ...c, balance: typeof c.balance === 'number' ? c.balance : 0 }))
          .filter(c => (c.balance || 0) !== 0)
          .sort((a, b) => (b.balance || 0) - (a.balance || 0));
        setCustomers(normalized);
      } else {
        const err = handleServiceError(res, 'getCustomers');
        showError(err.message);
      }
    } catch (e) {
      const err = handleServiceError(e, 'getCustomers');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const buildFullAddress = (customer?: Partial<Customer> | null) => {
    if (!customer) return '';
    return [
      (customer as any).doorNumber,
      (customer as any).floor,
      (customer as any).street,
      (customer as any).area,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  };

  const isMonthlyBilling = (customer: Customer) =>
    String(customer.billingType || '').toLowerCase().includes('monthly');

  const parseDeliveredAtTimestamp = (record: PurchaseRecord) => {
    const raw = record.deliveredAt || '';
    // Support dd/MM/yy and dd/MM/yyyy with optional AM/PM (including 1-digit hour like "1:41 pm")
    const match = raw.match(/(\d{2})\/(\d{2})\/(\d{2,4}).*?(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
    if (match) {
      const [, dd, mm, yy, hh, min, meridiem] = match;
      const yearNum = parseInt(yy, 10);
      const year = yy.length === 2 ? 2000 + yearNum : yearNum;
      let hours = parseInt(hh, 10);
      if (meridiem) {
        const isPM = meridiem.toLowerCase() === 'pm';
        hours = (hours % 12) + (isPM ? 12 : 0);
      }
      const date = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10), hours, parseInt(min, 10));
      const ts = date.getTime();
      if (!Number.isNaN(ts)) return ts;
    }

    const parsedDelivered = new Date(raw).getTime();
    if (!Number.isNaN(parsedDelivered)) return parsedDelivered;

    const fallback = record.orderedAt ? new Date(record.orderedAt).getTime() : NaN;
    return Number.isNaN(fallback) ? 0 : fallback;
  };

  const formatReceiptDate = (record: PurchaseRecord) => {
    const raw = record.deliveredAt || record.orderedAt || '';
    const match = raw.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    if (match) return match[1];
    const ts = parseDeliveredAtTimestamp(record);
    if (!ts) return '';
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const getReceiptRecordsForNonMonthly = (allRecords: PurchaseRecord[]) => {
    const sorted = [...allRecords].sort((a, b) => parseDeliveredAtTimestamp(a) - parseDeliveredAtTimestamp(b));
    const deliveries = sorted.filter((r) => Number(r.deliveredQty || 0) > 0);

    // Find the most recent payment entry (used as a cutoff).
    let lastPaymentTs = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const r = sorted[i];
      const isPayment = String(r.product || '').toLowerCase().includes('payment') && Number(r.deliveredQty || 0) === 0;
      if (isPayment && Number(r.amountPaid || 0) > 0) {
        lastPaymentTs = parseDeliveredAtTimestamp(r);
        break;
      }
    }

    const afterPayment = lastPaymentTs
      ? deliveries.filter((r) => parseDeliveredAtTimestamp(r) > lastPaymentTs)
      : deliveries;

    // Show up to 10 recent deliveries.
    const latest = afterPayment.slice(-10);
    return latest;
  };

  const buildLast3MonthOptions = () => {
    const now = getISTDate();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const opts: Array<{ key: string; label: string; start: Date; end: Date }> = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(startOfThisMonth.getFullYear(), startOfThisMonth.getMonth() - i, 1, 0, 0, 0, 0);
      const year = d.getFullYear();
      const month = d.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthShort = start.toLocaleString('en-GB', { month: 'short' });
      const label = `${monthShort.toLowerCase()} ${year}`;
      opts.push({ key, label, start, end });
    }
    return opts;
  };

  const getBannerDataUri = async (): Promise<string | null> => {
    try {
      const resolved = Image.resolveAssetSource(bannerImage as any);
      const uri = resolved?.uri;
      if (!uri) return null;

      const resp = await fetch(uri);
      const blob = await resp.blob();
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return dataUri || null;
    } catch {
      return null;
    }
  };

  const buildBillHtml = (params: {
    bannerDataUri?: string | null;
    customer: Customer;
    records: PurchaseRecord[];
    addressText: string;
  }) => {
    const { bannerDataUri, customer, records, addressText } = params;
    const qty = records.reduce((sum, r) => sum + (Number(r.deliveredQty || 0) || 0), 0);
    const unitPrice = Number((customer as any)?.price || 0) || 0;
    const computed = qty * unitPrice;
    const balance = Number((customer as any)?.balance || 0) || 0;
    const pending = computed < balance ? balance - computed : 0;

    const esc = (s: any) => String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const rows = records
      .map((r) => {
        const d = esc(formatReceiptDate(r));
        const q = esc(String(Number(r.deliveredQty || 0) || 0));
        return `<tr><td class="td-left">${d}</td><td class="td-right">${q}</td></tr>`;
      })
      .join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: 57mm auto; margin: 0; }
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; }
      .wrap { width: 57mm; padding: 2mm; box-sizing: border-box; }
      .center { text-align: center; }
      .banner { width: 100%; height: auto; display: block; margin: 0 auto 2mm auto; }
      .address { font-size: 10px; line-height: 14px; padding: 0 2mm; }
      .body { padding: 0 2mm; }
      .dash { border-top: 1px dashed #0f172a; margin: 2mm 0; }
      .name { font-weight: 800; font-size: 12px; margin: 0 0 1mm 0; }
      .line { font-size: 10px; line-height: 14px; margin: 0; }
      table { width: 100%; border-collapse: collapse; }
      th { font-size: 10px; font-weight: 800; text-align: left; padding: 0 0 1mm 0; }
      .th-right { text-align: right; }
      td { font-size: 10px; padding: 0.5mm 0; }
      .td-right { text-align: right; }
      .tot-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; padding: 0.5mm 0; }
      .tot-label { font-weight: 700; }
      .pending { color: #ef4444; font-weight: 800; }
      .total { font-weight: 900; font-size: 11px; }
      .thanks { text-align: center; font-size: 10px; font-weight: 700; margin-top: 6mm; }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${bannerDataUri ? `<img class="banner" src="${esc(bannerDataUri)}" />` : ''}
      <div class="center address">${esc(addressText).replace(/\n/g, '<br/>')}</div>
      <div class="body">
        <div class="dash"></div>
        <div class="name">${esc(customer.name)}</div>
        <div class="line">${esc(customer.mobile)}</div>
        <div class="line">${esc(buildFullAddress(customer) || 'No address')}</div>
        <div class="line">Price: ₹${esc(String(unitPrice))}</div>
        <div class="dash"></div>
        <table>
          <thead>
            <tr><th>Date</th><th class="th-right">Qty</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="dash"></div>
        <div class="tot-row"><span class="tot-label">Total Qty</span><span class="tot-label">${esc(String(qty))}</span></div>
        ${pending > 0 ? `<div class="tot-row"><span class="pending">Pending</span><span class="pending">₹${esc(String(pending))}</span></div>` : ''}
        <div class="tot-row"><span class="total">Total</span><span class="total">₹${esc(String(balance))}</span></div>
        <div class="thanks">Thank you!</div>
      </div>
    </div>
  </body>
</html>`;
  };

  const isUserCancelled = (e: unknown) => {
    const msg = String((e as any)?.message ?? (e as any)?.error ?? e ?? '').toLowerCase();
    const code = String((e as any)?.code ?? '').toLowerCase();
    if (code.includes('cancel')) return true;
    if (msg.includes('cancel')) return true;
    if (msg.includes('user did not share')) return true;
    if (msg.includes('share cancelled') || msg.includes('share canceled')) return true;
    return false;
  };

  const captureAndHandleBill = async () => {
    if (!printJob?.customer?.id) return;
    if (!receiptRef.current) return;

    try {
      setPrintingBill(true);

      // Wait for the receipt view to render.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 900));

      const tmpfile = await captureRef(receiptRef.current, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });

      const shareImage = async () => {
        try {
          await Share.open({
            url: tmpfile,
            type: 'image/jpeg',
            filename: `Bill-${printJob.customer.name || 'customer'}`,
          });
        } catch (shareErr) {
          if (isUserCancelled(shareErr)) return;
          throw shareErr;
        }
      };

      await shareImage();
    } catch (e) {
      if (!isUserCancelled(e)) {
        const err = handleServiceError(e, 'printBill');
        showError(err.message);
      }
    } finally {
      setPrintingBill(false);
      setPrintJob(null);
    }
  };

  useEffect(() => {
    if (!printJob) return;
    setReceiptBannerLoaded(false);
    setReceiptLaidOut(false);
    setShareBannerDataUri(null);

    // In debug, ViewShot can capture a blank area for bundled images.
    // Converting the banner to a data-URI makes it render reliably inside the capture.
    let cancelled = false;
    (async () => {
      const dataUri = await getShareBannerDataUri();
      if (cancelled) return;
      if (dataUri) {
        setShareBannerDataUri(dataUri);
        setReceiptBannerLoaded(true);
      }
    })();

    const t = setTimeout(() => {
      // Fallback: some Android builds don't reliably fire Image load events for bundled assets.
      setReceiptBannerLoaded(true);
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [printJob?.customer?.id, printJob?.records?.length]);

  useEffect(() => {
    if (!printJob) return;
    if (!receiptBannerLoaded) return;
    if (!receiptLaidOut) return;
    captureAndHandleBill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printJob?.customer?.id, receiptBannerLoaded, receiptLaidOut]);

  const openBillOptions = async (customer: Customer) => {
    try {
      if (!customer?.id) return;
      const result = await getCustomerPurchaseHistory(customer.id);
      if (!Array.isArray(result)) {
        const err = handleServiceError(result, 'getCustomerPurchaseHistory');
        showError(err.message);
        return;
      }

      const purchases = result;

      setBillCustomer(customer);
      setBillPurchases(purchases);
      if (isMonthlyBilling(customer)) {
        const opts = buildLast3MonthOptions();
        setBillMonthOptions(opts);
        setBillSelectedMonthKey(opts[0]?.key || null);
      } else {
        setBillMonthOptions([]);
        setBillSelectedMonthKey(null);
      }
      setShowBillOptionsModal(true);
    } catch (e) {
      const err = handleServiceError(e, 'openBillOptions');
      showError(err.message);
    }
  };

  const resolveBillRecords = () => {
    const customer = billCustomer;
    if (!customer?.id) return { ok: false as const, message: 'Customer missing' };
    const purchases = billPurchases;

    if (isMonthlyBilling(customer)) {
      const monthKey = billSelectedMonthKey;
      const m = billMonthOptions.find((x) => x.key === monthKey);
      if (!m) return { ok: false as const, message: 'Select a month' };

      const selected = purchases
        .filter((r) => Number(r.deliveredQty || 0) > 0)
        .filter((r) => {
          const ts = parseDeliveredAtTimestamp(r);
          if (!ts) return false;
          const d = new Date(ts);
          return d >= m.start && d <= m.end;
        })
        .sort((a, b) => parseDeliveredAtTimestamp(a) - parseDeliveredAtTimestamp(b));

      if (!selected.length) {
        return { ok: false as const, message: 'No purchase made on that month.' };
      }

      return { ok: true as const, records: selected };
    }

    const selected = getReceiptRecordsForNonMonthly(purchases);
    if (!selected.length) {
      return { ok: false as const, message: 'No deliveries found for this customer.' };
    }
    return { ok: true as const, records: selected };
  };

  const startBillAction = async (action: 'print' | 'image') => {
    const customer = billCustomer;
    if (!customer?.id) {
      setShowBillOptionsModal(false);
      return;
    }
    const res = resolveBillRecords();
    if (!res.ok) {
      setShowBillOptionsModal(false);
      showError(res.message, { title: 'No History' });
      return;
    }

    setShowBillOptionsModal(false);

    if (action === 'image') {
      setPrintJob({ customer, records: res.records });
      return;
    }

    try {
      setPrintingBill(true);
      const bannerDataUri = await getBannerDataUri();
      const addressText =
        'No.1 E/2, 19th Central Cross Street,\n' +
        '2nd Main Road, M.K.B Nagar, Chennai - 600039\n' +
        'Phone: 73056 99866';

      const html = buildBillHtml({
        bannerDataUri,
        customer,
        records: res.records,
        addressText,
      });

      await RNPrint.print({ html });
    } catch (e) {
      if (isUserCancelled(e)) return;
      // If printing fails (no printer / unsupported), fall back to share as JPEG.
      setPrintJob({ customer, records: res.records });
    } finally {
      setPrintingBill(false);
    }
  };

  const billingFilteredCustomers = useMemo(() => {
    if (billingFilter === 'all') return customers;
    return customers.filter((c) => {
      const monthly = isMonthlyBilling(c);
      return billingFilter === 'monthly' ? monthly : !monthly;
    });
  }, [customers, billingFilter]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return billingFilteredCustomers;
    const q = searchQuery.toLowerCase();
    return billingFilteredCustomers.filter(c => {
      const fullAddress = buildFullAddress(c).toLowerCase();
      if (c.name?.toLowerCase().includes(q)) return true;
      if (c.mobile?.includes(q)) return true;
      if (fullAddress.includes(q)) return true;
      if (c.alternateContacts?.some(contact => contact?.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [billingFilteredCustomers, searchQuery]);

  const totalBalance = useMemo(
    () => filtered.reduce((sum, c) => sum + (typeof c.balance === 'number' ? c.balance : 0), 0),
    [filtered]
  );

  const openPayModal = (customer: Customer) => {
    setPayCustomer(customer);
    setPayMethod('cash');
    setPayAmount((customer.balance || 0).toString());
    setPayRef('');
    setShowPayModal(true);
  };

  const submitPayment = async () => {
    if (!payCustomer?.id) {
      setShowPayModal(false);
      return;
    }
    const amountValue = Number(payAmount || 0);
    if (isNaN(amountValue) || amountValue <= 0) {
      showError('Enter a valid amount', { title: 'Validation' });
      return;
    }
    if (payMethod === 'online' && !payRef.trim()) {
      showError('Enter UTR / UPI transaction ID', { title: 'Validation' });
      return;
    }
    try {
      setSubmittingPay(true);
      const startingBalance = payCustomer.balance || 0;
      const newBalance = startingBalance - amountValue;

      // 1) Update customer balance
      const res = await updateCustomer(payCustomer.id, { balance: newBalance });
      if (res !== true) {
        const err = handleServiceError(res, 'updateCustomer');
        showError(err.message);
        setSubmittingPay(false);
        return;
      }

      // 2) Add purchase history entry for payment
      const now = getISTDate();
      const stamp = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      await addPurchaseHistory(payCustomer.id, {
        product: 'payment',
        deliveredQty: 0,
        emptyQty: 0,
        orderedAt: stamp,
        deliveredAt: stamp,
        billAmount: startingBalance,
        amountPaid: amountValue,
        paymentMethod: payMethod,
        paymentRef: payMethod === 'online' ? Number(payRef) || 0 : 0,
      });

      // 3) Update sales record for today (pending payment received + total sale)
      const cashPaidValue = payMethod === 'cash' ? amountValue : 0;
      const onlinePaidValue = payMethod === 'online' ? amountValue : 0;
      await updateSalesRecord(
        0,
        0,
        0,
        0,
        0,
        false,
        0,
        0,
        0,
        0,
        cashPaidValue,
        onlinePaidValue
      );

      // 4) Add daily record under Payments doc
      const dailyEntry: DailyRecordEntry = {
        customerId: payCustomer.id,
        customerName: payCustomer.name,
        customerMobile: payCustomer.mobile,
        product: 'payment',
        orderedAt: stamp,
        deliveredAt: stamp,
        deliveredQty: 0,
        emptyQty: 0,
        billAmount: startingBalance,
        saleAmount: 0,
        amountPaid: amountValue,
        paymentMethod: payMethod,
        paymentRef: payMethod === 'online' ? Number(payRef) || 0 : 0,
        pendingPaymentReceived: amountValue,
      };
      await addDailyRecord('Payments', dailyEntry);

      await load();
      setShowPayModal(false);
      setPayCustomer(null);
    } catch (e) {
      const err = handleServiceError(e, 'submitPayment');
      showError(err.message);
    } finally {
      setSubmittingPay(false);
    }
  };

  const renderItem = ({ item }: { item: Customer }) => {
    const fullAddress = buildFullAddress(item);

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedCustomer(item)}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="wallet" size={20} color="#0ea5e9" />
          <Text style={styles.title}>{item.name}</Text>
          <Text style={[styles.balance, { color: (item.balance || 0) >= 0 ? '#16a34a' : '#ef4444' }]}>₹{item.balance || 0}</Text>
          <TouchableOpacity style={styles.payBtn} onPress={() => openPayModal(item)}>
            <MaterialCommunityIcons name="cash-multiple" size={20} color="#0ea5e9" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.printBtn} onPress={() => openBillOptions(item)}>
            <MaterialCommunityIcons name="printer-outline" size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>{item.mobile}</Text>
        <Text style={styles.sub}>{fullAddress || 'No address provided'}</Text>
      </TouchableOpacity>
    );
  };

  if (selectedCustomer) {
    return (
      <CustomerDetailsScreen
        customer={selectedCustomer as any}
        onBack={() => setSelectedCustomer(null)}
        onEdit={() => {}}
        onViewHistory={() => {}}
      />
    );
  }

  if (showHistory) {
    return <PaymentHistoryScreen onBack={() => setShowHistory(false)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#0f172a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>Payment Balances</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowBillingFilterModal(true)} style={styles.historyBtn}>
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color={billingFilter === 'monthly' ? '#0ea5e9' : '#0f172a'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyBtn}>
            <MaterialCommunityIcons name="history" size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0ea5e9" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No balances to show</Text>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              colors={["#0ea5e9"]}
              tintColor="#0ea5e9"
            />
          }
        />
      )}

      {!loading ? (
        <View style={styles.summaryBar}>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryLabel}>total</Text>
            <Text style={styles.summaryValue}>₹{totalBalance.toFixed(2)}</Text>
          </View>
        </View>
      ) : null}

      <Modal visible={showPayModal} transparent animationType="fade" onRequestClose={() => setShowPayModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPayModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={styles.modalSubtitle}>{payCustomer?.name}</Text>
              <Text style={styles.modalSubtitleSmall}>{payCustomer?.mobile}</Text>

              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[styles.methodBtn, payMethod === 'cash' && styles.methodBtnActive]}
                  onPress={() => setPayMethod('cash')}
                  disabled={submittingPay}
                >
                  <Text style={[styles.methodText, payMethod === 'cash' && styles.methodTextActive]}>Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodBtn, payMethod === 'online' && styles.methodBtnActive]}
                  onPress={() => setPayMethod('online')}
                  disabled={submittingPay}
                >
                  <Text style={[styles.methodText, payMethod === 'online' && styles.methodTextActive]}>Online</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Amount</Text>
                <TextInput
                  style={styles.fieldInput}
                  keyboardType="number-pad"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="0"
                />
              </View>

              {payMethod === 'online' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>UTR / UPI Transaction ID</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={payRef}
                    onChangeText={(text) => setPayRef(text.replace(/[^0-9]/g, ''))}
                    placeholder="Enter reference"
                    keyboardType="number-pad"
                  />
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, submittingPay && { opacity: 0.6 }]}
                onPress={submitPayment}
                disabled={submittingPay}
              >
                {submittingPay ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showBillingFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBillingFilterModal(false)}
      >
        <Pressable style={styles.filterOverlay} onPress={() => setShowBillingFilterModal(false)}>
          <Pressable style={styles.filterCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.filterTitle}>Filter Billing Type</Text>

            <TouchableOpacity
              style={[styles.filterOption, billingFilter === 'all' ? styles.filterOptionActive : null]}
              onPress={() => {
                setBillingFilter('all');
                setShowBillingFilterModal(false);
              }}
            >
              <Text style={[styles.filterOptionText, billingFilter === 'all' ? styles.filterOptionTextActive : null]}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterOption, billingFilter === 'cash' ? styles.filterOptionActive : null]}
              onPress={() => {
                setBillingFilter('cash');
                setShowBillingFilterModal(false);
              }}
            >
              <Text style={[styles.filterOptionText, billingFilter === 'cash' ? styles.filterOptionTextActive : null]}>
                Cash
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterOption, billingFilter === 'monthly' ? styles.filterOptionActive : null]}
              onPress={() => {
                setBillingFilter('monthly');
                setShowBillingFilterModal(false);
              }}
            >
              <Text
                style={[
                  styles.filterOptionText,
                  billingFilter === 'monthly' ? styles.filterOptionTextActive : null,
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showBillOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBillOptionsModal(false)}
      >
        <Pressable style={styles.filterOverlay} onPress={() => setShowBillOptionsModal(false)}>
          <Pressable style={styles.filterCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.filterTitle}>Bill Options</Text>

            {billCustomer && isMonthlyBilling(billCustomer) ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.billSubTitle}>Select Month (last 3 months)</Text>
                <View style={styles.monthRow}>
                  {billMonthOptions.map((m) => {
                    const active = billSelectedMonthKey === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        style={[styles.monthChip, active ? styles.monthChipActive : null]}
                        onPress={() => setBillSelectedMonthKey(m.key)}
                      >
                        <Text style={[styles.monthChipText, active ? styles.monthChipTextActive : null]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.billActionRow}>
              <TouchableOpacity style={styles.billActionBtn} onPress={() => startBillAction('image')}>
                <MaterialCommunityIcons name="image-outline" size={20} color="#0ea5e9" />
                <Text style={styles.billActionText}>Image</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.billActionBtn} onPress={() => startBillAction('print')}>
                <MaterialCommunityIcons name="printer-outline" size={20} color="#16a34a" />
                <Text style={styles.billActionText}>Print</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={printingBill && !printJob}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.printOverlay}>
          <View style={styles.printCard}>
            <View style={styles.printHeader}>
              <Text style={styles.printTitle}>Preparing bill…</Text>
              <ActivityIndicator size="small" color="#0ea5e9" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Hidden receipt renderer (captured to image for print/share) */}
      <Modal visible={!!printJob} transparent animationType="fade">
        <View style={styles.printOverlay}>
          <View style={styles.printCard}>
            <View style={styles.printHeader}>
              <Text style={styles.printTitle}>Preparing bill…</Text>
              {printingBill ? <ActivityIndicator size="small" color="#0ea5e9" /> : null}
            </View>

            <ViewShot
              ref={(r) => {
                receiptRef.current = r;
              }}
              options={{ format: 'jpg', quality: 0.92 }}
            >
              <View style={styles.receiptRoot}>
                <View
                  style={styles.receiptRootInner}
                  onLayout={() => setReceiptLaidOut(true)}
                  collapsable={false}
                >
                  <Image
                    source={shareBannerDataUri ? ({ uri: shareBannerDataUri } as any) : shareBannerSource}
                    style={styles.receiptBanner}
                    resizeMode="contain"
                    fadeDuration={0}
                    onLoadEnd={() => setReceiptBannerLoaded(true)}
                    onLoad={() => setReceiptBannerLoaded(true)}
                    onError={() => setReceiptBannerLoaded(true)}
                  />
                  <Text style={styles.receiptAddress}>
                    No.1 E/2, 19th Central Cross Street,{"\n"}
                    2nd Main Road, M.K.B Nagar, Chennai - 600039 {"\n"}
                    Phone: 73056 99866
                  </Text>

                  <View style={styles.receiptBody}>
                    <View style={styles.receiptDivider} />

                    <Text style={styles.receiptCustomerName}>{printJob?.customer?.name || ''}</Text>
                    <Text style={styles.receiptLine}>{printJob?.customer?.mobile || ''}</Text>
                    <Text style={styles.receiptLine}>{buildFullAddress(printJob?.customer as any) || 'No address'}</Text>
                    <Text style={styles.receiptLine}>
                      Price: ₹{String(Number((printJob?.customer as any)?.price || 0) || 0)}
                    </Text>

                    <View style={styles.receiptDivider} />

                    <View style={styles.receiptTableHeader}>
                      <Text style={[styles.receiptTh, styles.receiptColLeft]}>Date</Text>
                      <Text style={[styles.receiptTh, styles.receiptColRight]}>Qty</Text>
                    </View>

                    {(printJob?.records || []).map((r, idx) => (
                      <View key={`${idx}`} style={styles.receiptRow}>
                        <Text style={styles.receiptColLeft}>{formatReceiptDate(r)}</Text>
                        <Text style={[styles.receiptColRight, styles.receiptTdRight]}>
                          {String(Number(r.deliveredQty || 0) || 0)}
                        </Text>
                      </View>
                    ))}

                    <View style={styles.receiptDivider} />

                    {(() => {
                      const qty = (printJob?.records || []).reduce(
                        (sum, r) => sum + (Number(r.deliveredQty || 0) || 0),
                        0
                      );
                      const unitPrice = Number((printJob?.customer as any)?.price || 0) || 0;
                      const computed = qty * unitPrice;
                      const balance = Number((printJob?.customer as any)?.balance || 0) || 0;
                      const pending = computed < balance ? balance - computed : 0;

                      return (
                        <View>
                          <View style={styles.receiptTotalsRow}>
                            <Text style={styles.receiptTotalsLabel}>Total Qty</Text>
                            <Text style={styles.receiptTotalsValue}>{String(qty)}</Text>
                          </View>

                          {pending > 0 ? (
                            <View style={styles.receiptTotalsRow}>
                              <Text style={[styles.receiptPending, styles.receiptTotalsLabel]}>Pending</Text>
                              <Text style={[styles.receiptPending, styles.receiptTotalsValue]}>
                                ₹{String(pending)}
                              </Text>
                            </View>
                          ) : null}

                          <View style={styles.receiptTotalsRow}>
                            <Text style={styles.receiptTotalLabel}>Total</Text>
                            <Text style={styles.receiptTotalValue}>₹{String(balance)}</Text>
                          </View>
                        </View>
                      );
                    })()}

                    <View style={{ height: 18 }} />
                    <Text style={styles.receiptThankYou}>Thank you!</Text>
                  </View>
                </View>
              </View>
            </ViewShot>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 8 },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  historyBtn: { padding: 6, marginLeft: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', gap: 8 },
  searchInput: { flex: 1, color: '#0f172a', paddingVertical: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  balance: { fontWeight: '700' },
  payBtn: { padding: 6, marginLeft: 6 },
  printBtn: { padding: 6 },
  sub: { marginTop: 4, color: '#475569', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  summaryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 180,
    width: '100%',
    maxWidth: 420,
  },
  summaryLabel: { color: '#475569', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  summaryValue: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: { width: '90%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  modalSubtitleSmall: { color: '#475569', marginBottom: 12 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  methodBtnActive: { borderColor: '#0ea5e9', backgroundColor: '#e0f2fe' },
  methodText: { color: '#0f172a', fontWeight: '600' },
  methodTextActive: { color: '#0ea5e9' },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { color: '#334155', marginBottom: 6, fontWeight: '600' },
  fieldInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#0f172a', backgroundColor: '#fff' },
  saveBtn: { marginTop: 6, backgroundColor: '#0ea5e9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  filterCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
  filterTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  filterOption: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterOptionActive: { borderColor: '#0ea5e9', backgroundColor: '#e0f2fe' },
  filterOptionText: { color: '#0f172a', fontWeight: '600' },
  filterOptionTextActive: { color: '#0ea5e9' },

  billSubTitle: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  monthRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  monthChipActive: { borderColor: '#0ea5e9', backgroundColor: '#e0f2fe' },
  monthChipText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
  monthChipTextActive: { color: '#0ea5e9' },

  billActionRow: { flexDirection: 'row', gap: 10 },
  billActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  billActionText: { color: '#0f172a', fontWeight: '800' },

  printOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  printCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, alignItems: 'center' },
  printHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  printTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  // Receipt styles (58mm-friendly)
  receiptRoot: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignSelf: 'center',
  },
  receiptRootInner: { width: '100%' },
  receiptBanner: { width: '100%', height: 80, marginBottom: 6, alignSelf: 'center' },
  receiptAddress: { textAlign: 'center', fontSize: 10, color: '#0f172a', lineHeight: 14, alignSelf: 'center', paddingHorizontal: 10 },
  receiptBody: { paddingHorizontal: 10 },
  receiptDivider: { borderTopWidth: 1, borderTopColor: '#0f172a', borderStyle: 'dashed', marginVertical: 8 },
  receiptCustomerName: { fontSize: 12, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  receiptLine: { fontSize: 10, color: '#0f172a', lineHeight: 14 },

  receiptTableHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  receiptTh: { fontSize: 10, fontWeight: '800', color: '#0f172a' },
  receiptColLeft: { flex: 1, fontSize: 10, color: '#0f172a' },
  receiptColRight: { width: 60, textAlign: 'right' },
  receiptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 1 },
  receiptTd: { fontSize: 10, color: '#0f172a' },
  receiptTdRight: { fontSize: 10, color: '#0f172a' },

  receiptTotalsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 1 },
  receiptTotalsLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: '#0f172a' },
  receiptTotalsValue: { width: 80, textAlign: 'right', fontSize: 10, fontWeight: '700', color: '#0f172a' },
  receiptPending: { fontSize: 10, fontWeight: '800', color: '#ef4444' },
  receiptTotalLabel: { flex: 1, fontSize: 11, fontWeight: '900', color: '#0f172a' },
  receiptTotalValue: { width: 80, textAlign: 'right', fontSize: 11, fontWeight: '900', color: '#0f172a' },
  receiptThankYou: { textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#0f172a' },
});
