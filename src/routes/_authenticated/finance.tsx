import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, Stat, inputClass } from "@/components/ui-kit";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import {
  createBudget,
  createPaymentVoucher,
  createPurchaseOrder,
  createPurchaseRequest,
  createSupplier,
  createSupplierInvoice,
  createStudentInvoice,
  recordGoodsReceipt,
  recordStudentPayment,
  reviewSupplierInvoice,
  reviewPurchaseRequest,
  submitBudgetRevision,
  updateBudgetStatus,
} from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance · EduTrack" },
      {
        name: "description",
        content: "Integrated school finance, budgeting and accounting dashboard.",
      },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canView = hasAny(me?.roles, [
    "head_teacher",
    "bursar",
    "hod",
  ]);
  const db = supabase as any;
  const [invoiceForm, setInvoiceForm] = useState({
    studentId: "",
    invoiceNumber: `INV-${new Date().getFullYear()}-001`,
    amount: "0",
  });
  const [paymentForm, setPaymentForm] = useState({
    studentId: "",
    paymentNumber: `PAY-${new Date().getFullYear()}-001`,
    amount: "0",
    paymentMethod: "cash",
  });
  const [budgetForm, setBudgetForm] = useState({
    financialYearId: "",
    title: `Budget ${new Date().getFullYear()}`,
    departmentName: "",
    proposedAmount: "0",
  });
  const [supplierForm, setSupplierForm] = useState({
    supplierName: "",
    contactPerson: "",
    phone: "",
  });
  const [requestForm, setRequestForm] = useState({
    requestNumber: `PR-${new Date().getFullYear()}-001`,
    budgetId: "",
    supplierId: "",
    itemDescription: "",
    requestedAmount: "0",
    departmentName: "",
  });
  const [procurementSelection, setProcurementSelection] = useState({
    purchaseRequestId: "",
    purchaseOrderId: "",
    supplierInvoiceId: "",
    supplierId: "",
    goodsReceiptOrderId: "",
    voucherInvoiceId: "",
  });

  const { data } = useQuery({
    queryKey: ["finance-dashboard", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [
        years,
        students,
        budgets,
        budgetLines,
        transactions,
        payments,
        journals,
        receipts,
        suppliers,
        departments,
        purchaseRequests,
        purchaseOrders,
        goodsReceipts,
        supplierInvoices,
        paymentVouchers,
      ] = await Promise.all([
        db.from("financial_years").select("*").eq("school_id", schoolId!),
        db.from("students").select("id, full_name").eq("school_id", schoolId!).is("deleted_at", null).order("full_name"),
        db.from("budgets").select("*").eq("school_id", schoolId!),
        db.from("budget_lines").select("*").eq("school_id", schoolId!),
        db.from("transactions").select("*").eq("school_id", schoolId!),
        db.from("payments").select("*").eq("school_id", schoolId!),
        db.from("journal_entries").select("*").eq("school_id", schoolId!),
        db.from("receipts").select("*").eq("school_id", schoolId!),
        db.from("suppliers").select("*").eq("school_id", schoolId!),
        db.from("departments").select("id, name, hod_user_id").eq("school_id", schoolId!),
        db.from("purchase_requests").select("*").eq("school_id", schoolId!),
        db.from("purchase_orders").select("*").eq("school_id", schoolId!),
        db.from("goods_receipts").select("*").eq("school_id", schoolId!),
        db.from("approved_invoices").select("*").eq("school_id", schoolId!),
        db.from("payment_vouchers").select("*").eq("school_id", schoolId!),
      ]);

      return {
        years: years.data ?? [],
        students: students.data ?? [],
        budgets: budgets.data ?? [],
        budgetLines: budgetLines.data ?? [],
        transactions: transactions.data ?? [],
        payments: payments.data ?? [],
        journals: journals.data ?? [],
        receipts: receipts.data ?? [],
        suppliers: suppliers.data ?? [],
        departments: departments.data ?? [],
        purchaseRequests: purchaseRequests.data ?? [],
        purchaseOrders: purchaseOrders.data ?? [],
        goodsReceipts: goodsReceipts.data ?? [],
        supplierInvoices: supplierInvoices.data ?? [],
        paymentVouchers: paymentVouchers.data ?? [],
      };
    },
  });

  const myDepartment = (me?.profile as any)?.department_id
    ? (data?.departments ?? []).find((dept: any) => dept.id === (me?.profile as any).department_id)?.name ?? null
    : null;
  const isHod = hasAny(me?.roles, ["hod"]);
  const departmentTag = isHod ? myDepartment : null;
  const scoped = <T extends { department_name?: string | null }>(rows: T[]) =>
    isHod && myDepartment ? rows.filter((row) => (row.department_name ?? null) === myDepartment) : rows;
  const scopedBudgetIds = new Set(
    isHod && myDepartment
      ? (data?.budgets ?? [])
          .filter((budget: any) => (budget.department_name ?? null) === myDepartment)
          .map((budget: any) => budget.id)
      : (data?.budgets ?? []).map((budget: any) => budget.id),
  );
  const scopedBudgets = isHod && myDepartment
    ? (data?.budgets ?? []).filter((budget: any) => (budget.department_name ?? null) === myDepartment)
    : (data?.budgets ?? []);
  const scopedBudgetLines = isHod
    ? (data?.budgetLines ?? []).filter((line: any) => scopedBudgetIds.has(line.budget_id))
    : (data?.budgetLines ?? []);
  const scopedTransactions = isHod ? [] : (data?.transactions ?? []);
  const scopedPayments = isHod ? [] : (data?.payments ?? []);
  const scopedPurchaseOrders = scoped((data?.purchaseOrders ?? []) as any[]);
  const scopedSupplierInvoices = scoped((data?.supplierInvoices ?? []) as any[]);
  const scopedPaymentVouchers = scoped((data?.paymentVouchers ?? []) as any[]);
  const totals = {
    income: scopedTransactions
      .filter((row: any) => row.transaction_type === "income")
      .reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0),
    expenditure: scopedTransactions
      .filter((row: any) => row.transaction_type === "expense")
      .reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0),
    payments: scopedPayments.reduce(
      (sum: number, row: any) => sum + Number(row.amount ?? 0),
      0,
    ),
    approvedBudget: scopedBudgetLines.reduce(
      (sum: number, row: any) => sum + Number(row.approved_amount ?? 0),
      0,
    ),
    revisedBudget: scopedBudgetLines.reduce(
      (sum: number, row: any) => sum + Number(row.revised_amount ?? 0),
      0,
    ),
    openOrders: scopedPurchaseOrders.filter((row: any) => row.status !== "received").length,
    pendingInvoices: scopedSupplierInvoices.filter(
      (row: any) => row.approval_status === "pending",
    ).length,
    voucherTotal: scopedPaymentVouchers.reduce(
      (sum: number, row: any) => sum + Number(row.amount ?? 0),
      0,
    ),
    cashBalance: scopedTransactions
      .filter((row: any) => row.transaction_type !== "journal")
      .reduce(
        (sum: number, row: any) =>
          sum +
          (row.transaction_type === "income"
            ? Number(row.total_amount ?? 0)
            : -Number(row.total_amount ?? 0)),
        0,
      ),
  };

  const chartData = [
    { name: "Income", value: totals.income },
    { name: "Expenditure", value: totals.expenditure },
    { name: "Budget", value: totals.approvedBudget },
    { name: "Revised", value: totals.revisedBudget },
  ];

  const flowData = scopedTransactions
    .slice(0, 8)
    .map((row: any) => ({
      name: row.transaction_number,
      income: row.transaction_type === "income" ? Number(row.total_amount ?? 0) : 0,
      expense: row.transaction_type === "expense" ? Number(row.total_amount ?? 0) : 0,
    }))
    .reverse();
  const spendData = [
    { name: "Budget", value: totals.approvedBudget },
    {
      name: "Orders",
      value: scopedPurchaseOrders.reduce(
        (sum: number, row: any) => sum + Number(row.total_amount ?? 0),
        0,
      ),
    },
    {
      name: "Invoices",
      value: scopedSupplierInvoices.reduce(
        (sum: number, row: any) => sum + Number(row.amount ?? 0),
        0,
      ),
    },
    { name: "Vouchers", value: totals.voucherTotal },
  ];
  const invoiceMutation = useMutation({
    mutationFn: async () => {
      const studentId = invoiceForm.studentId.trim();
      const invoiceNumber = invoiceForm.invoiceNumber.trim();
      const amount = Number(invoiceForm.amount);
      if (!studentId) throw new Error("Select a student before creating the invoice");
      if (!(data?.students ?? []).some((student: any) => student.id === studentId)) {
        throw new Error("The selected student is no longer available. Choose a student again");
      }
      if (!invoiceNumber) throw new Error("Enter an invoice number first");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invoice amount must be greater than zero");
      return createStudentInvoice({
        data: {
          studentId,
          invoiceNumber,
          amount,
        },
      });
    },
    onSuccess: () => {
      toast.success("Invoice created");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const paymentMutation = useMutation({
    mutationFn: async () => {
      const studentId = paymentForm.studentId.trim();
      const paymentNumber = paymentForm.paymentNumber.trim();
      const amount = Number(paymentForm.amount);
      if (!studentId) throw new Error("Select a student before recording the payment");
      if (!(data?.students ?? []).some((student: any) => student.id === studentId)) {
        throw new Error("The selected student is no longer available. Choose a student again");
      }
      if (!paymentNumber) throw new Error("Enter a payment number first");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero");
      return recordStudentPayment({
        data: {
          studentId,
          paymentNumber,
          amount,
          paymentMethod: paymentForm.paymentMethod,
        },
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const budgetMutation = useMutation({
    mutationFn: async () => {
      const title = budgetForm.title.trim();
      const amount = Number(budgetForm.proposedAmount);
      if (!budgetForm.financialYearId) throw new Error("Select a financial year first");
      if (!(data?.years ?? []).some((year: any) => year.id === budgetForm.financialYearId)) {
        throw new Error("The selected financial year is no longer available. Choose a year again");
      }
      if (!title) throw new Error("Enter a budget title first");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Proposed amount must be greater than zero");
      return createBudget({
        data: {
          financialYearId: budgetForm.financialYearId,
          title,
          departmentName: budgetForm.departmentName || null,
          budgetLines: [
            {
              budgetCategory: "Operational",
              periodName: "Annual",
              proposedAmount: amount,
            },
          ],
        },
      });
    },
    onSuccess: () => {
      toast.success("Budget created");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const approveBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) =>
      updateBudgetStatus({
        data: {
          budgetId,
          status: "approved",
        },
      }),
    onSuccess: () => {
      toast.success("Budget approved");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const reviseBudgetMutation = useMutation({
    mutationFn: async (budget: any) =>
      submitBudgetRevision({
        data: {
          budgetId: budget.id,
          note: "Departmental revision submitted",
          revisedAmounts: (data?.budgetLines ?? [])
            .filter((line: any) => line.budget_id === budget.id)
            .map((line: any) => ({
              lineId: line.id,
              revisedAmount: Number(line.proposed_amount ?? 0),
            })),
        },
      }),
    onSuccess: () => {
      toast.success("Budget sent for revision");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const supplierMutation = useMutation({
    mutationFn: async () => {
      const supplierName = supplierForm.supplierName.trim();
      if (!supplierName) throw new Error("Enter the supplier name first");
      return createSupplier({
        data: {
          supplierName,
          contactPerson: supplierForm.contactPerson.trim() || null,
          phone: supplierForm.phone.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Supplier added");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const supplierInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!procurementSelection.supplierId) throw new Error("Select a supplier before creating the invoice");
      if (!procurementSelection.purchaseOrderId) throw new Error("Select a purchase order before creating the invoice");
      const supplier = (data?.suppliers ?? []).find((row: any) => row.id === procurementSelection.supplierId);
      const purchaseOrder = (data?.purchaseOrders ?? []).find((row: any) => row.id === procurementSelection.purchaseOrderId);
      if (!supplier) throw new Error("The selected supplier is no longer available. Choose a supplier again");
      if (!purchaseOrder) throw new Error("The selected purchase order is no longer available. Choose an order again");
      const amount = Number(purchaseOrder.total_amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("The purchase order has no valid amount");
      return createSupplierInvoice({
        data: {
          invoiceNumber: `SI-${new Date().getFullYear()}-001`,
          supplierId: procurementSelection.supplierId,
          purchaseOrderId: procurementSelection.purchaseOrderId,
          departmentName: purchaseOrder.department_name ?? departmentTag,
          amount,
        },
      });
    },
    onSuccess: () => {
      toast.success("Supplier invoice created");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const requestMutation = useMutation({
    mutationFn: async () => {
      const requestNumber = requestForm.requestNumber.trim();
      const itemDescription = requestForm.itemDescription.trim();
      const requestedAmount = Number(requestForm.requestedAmount);
      if (!requestNumber) throw new Error("Enter a request number first");
      if (!itemDescription) throw new Error("Describe the item being requested first");
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) throw new Error("Requested amount must be greater than zero");
      if (requestForm.budgetId && !(data?.budgets ?? []).some((budget: any) => budget.id === requestForm.budgetId)) {
        throw new Error("The selected budget is no longer available. Choose a budget again");
      }
      if (requestForm.supplierId && !(data?.suppliers ?? []).some((supplier: any) => supplier.id === requestForm.supplierId)) {
        throw new Error("The selected supplier is no longer available. Choose a supplier again");
      }
      return createPurchaseRequest({
        data: {
          requestNumber,
          budgetId: requestForm.budgetId || null,
          supplierId: requestForm.supplierId || null,
          departmentName: requestForm.departmentName.trim() || null,
          itemDescription,
          requestedAmount,
        },
      });
    },
    onSuccess: () => {
      toast.success("Purchase request submitted");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const reviewRequestMutation = useMutation({
    mutationFn: async (requestId: string) =>
      reviewPurchaseRequest({
        data: {
          requestId,
          status: "approved",
          approvedAmount: 0,
        },
      }),
    onSuccess: () => {
      toast.success("Purchase request reviewed");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!procurementSelection.purchaseRequestId) throw new Error("Select a purchase request before creating the order");
      if (!procurementSelection.supplierId) throw new Error("Select a supplier before creating the order");
      const request = (data?.purchaseRequests ?? []).find((row: any) => row.id === procurementSelection.purchaseRequestId);
      const supplier = (data?.suppliers ?? []).find((row: any) => row.id === procurementSelection.supplierId);
      if (!request) throw new Error("The selected purchase request is no longer available. Choose a request again");
      if (!supplier) throw new Error("The selected supplier is no longer available. Choose a supplier again");
      const totalAmount = Number(request.requested_amount);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error("The purchase request has no valid amount");
      return createPurchaseOrder({
        data: {
          orderNumber: `PO-${new Date().getFullYear()}-001`,
          purchaseRequestId: procurementSelection.purchaseRequestId,
          supplierId: procurementSelection.supplierId,
          departmentName: request.department_name ?? departmentTag,
          totalAmount,
        },
      });
    },
    onSuccess: () => {
      toast.success("Purchase order created");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const goodsReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!procurementSelection.purchaseOrderId) throw new Error("Select a purchase order before recording goods received");
      const order = (data?.purchaseOrders ?? []).find((row: any) => row.id === procurementSelection.purchaseOrderId);
      if (!order) throw new Error("The selected purchase order is no longer available. Choose an order again");
      const itemsReceived = Number(order.total_amount);
      if (!Number.isFinite(itemsReceived) || itemsReceived <= 0) throw new Error("The purchase order has no valid received amount");
      return recordGoodsReceipt({
        data: {
          purchaseOrderId: procurementSelection.purchaseOrderId,
          receiptNumber: `GRN-${new Date().getFullYear()}-001`,
          itemsReceived,
        },
      });
    },
    onSuccess: () => {
      toast.success("Goods receipt recorded");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const invoiceReviewMutation = useMutation({
    mutationFn: async () => {
      if (!procurementSelection.supplierInvoiceId) throw new Error("Select a supplier invoice before approving it");
      if (!(data?.supplierInvoices ?? []).some((invoice: any) => invoice.id === procurementSelection.supplierInvoiceId)) {
        throw new Error("The selected supplier invoice is no longer available. Choose an invoice again");
      }
      return reviewSupplierInvoice({
        data: {
          invoiceId: procurementSelection.supplierInvoiceId,
          status: "approved",
          note: "Approved for voucher processing",
        },
      });
    },
    onSuccess: () => {
      toast.success("Invoice approved");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const voucherMutation = useMutation({
    mutationFn: async () => {
      if (!procurementSelection.voucherInvoiceId) throw new Error("Select an approved invoice before creating the voucher");
      if (!procurementSelection.supplierId) throw new Error("Select the payee supplier before creating the voucher");
      const invoice = (data?.supplierInvoices ?? []).find((row: any) => row.id === procurementSelection.voucherInvoiceId);
      const supplier = (data?.suppliers ?? []).find((row: any) => row.id === procurementSelection.supplierId);
      if (!invoice) throw new Error("The selected invoice is no longer available. Choose an invoice again");
      if (!supplier) throw new Error("The selected supplier is no longer available. Choose a supplier again");
      const amount = Number(invoice.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("The invoice has no valid amount");
      return createPaymentVoucher({
        data: {
          voucherNumber: `PV-${new Date().getFullYear()}-001`,
          invoiceId: procurementSelection.voucherInvoiceId,
          payeeName: supplier.supplier_name,
          departmentName: invoice.department_name ?? departmentTag,
          amount,
          paymentMethod: "bank",
        },
      });
    },
    onSuccess: () => {
      toast.success("Payment voucher created");
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  if (!canView) {
    return (
      <PageHeader title="Finance" description="You do not have permission to view this area." />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance dashboard"
        description="A first-pass integrated finance workspace for budgets, transactions and reporting."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cash balance" value={totals.cashBalance.toLocaleString()} />
        <Stat label="Income" value={totals.income.toLocaleString()} />
        <Stat label="Expenditure" value={totals.expenditure.toLocaleString()} />
        <Stat label="Approved budget" value={totals.approvedBudget.toLocaleString()} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open orders" value={totals.openOrders.toString()} />
        <Stat label="Pending invoices" value={totals.pendingInvoices.toString()} />
        <Stat label="Voucher value" value={totals.voucherTotal.toLocaleString()} />
        <Stat label="Goods receipts" value={(data?.goodsReceipts ?? []).length.toString()} />
      </div>

      <Panel title="Financial snapshot">
        <div className="grid gap-4 lg:grid-cols-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={flowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="var(--color-chart-2)" />
              <Line type="monotone" dataKey="expense" stroke="var(--color-chart-3)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Spend and commitments">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={spendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Module status">
        <div className="flex flex-wrap gap-2">
          <Pill tone="success">Schema foundation added</Pill>
          <Pill tone="warning">Fees and budgeting enabled</Pill>
          <Pill tone="muted">Procurement and vouchers enabled</Pill>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Create student invoice">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Student ID">
              <select
                required
                className={inputClass}
                value={invoiceForm.studentId}
                onChange={(event) =>
                  setInvoiceForm({ ...invoiceForm, studentId: event.target.value })
                }
              >
                <option value="">Select student</option>
                {((data as any)?.students ?? []).map((student: any) => (
                  <option key={student.id} value={student.id}>{student.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Invoice number">
              <input
                required
                className={inputClass}
                value={invoiceForm.invoiceNumber}
                onChange={(event) =>
                  setInvoiceForm({ ...invoiceForm, invoiceNumber: event.target.value })
                }
              />
            </Field>
            <Field label="Amount">
              <input
                required
                type="number"
                min="0.01"
                className={inputClass}
                value={invoiceForm.amount}
                onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: event.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Btn
              onClick={() => invoiceMutation.mutate()}
              variant="accent"
              disabled={invoiceMutation.isPending}
            >
              Create invoice
            </Btn>
          </div>
        </Panel>

        <Panel title="Record student payment">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Student ID">
              <select
                required
                className={inputClass}
                value={paymentForm.studentId}
                onChange={(event) =>
                  setPaymentForm({ ...paymentForm, studentId: event.target.value })
                }
              >
                <option value="">Select student</option>
                {((data as any)?.students ?? []).map((student: any) => (
                  <option key={student.id} value={student.id}>{student.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment number">
              <input
                required
                className={inputClass}
                value={paymentForm.paymentNumber}
                onChange={(event) =>
                  setPaymentForm({ ...paymentForm, paymentNumber: event.target.value })
                }
              />
            </Field>
            <Field label="Amount">
              <input
                required
                type="number"
                min="0.01"
                className={inputClass}
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
              />
            </Field>
            <Field label="Method">
              <select
                className={inputClass}
                value={paymentForm.paymentMethod}
                onChange={(event) =>
                  setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })
                }
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="cheque">Cheque</option>
                <option value="transfer">Electronic transfer</option>
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Btn
              onClick={() => paymentMutation.mutate()}
              variant="accent"
              disabled={paymentMutation.isPending}
            >
              Record payment
            </Btn>
          </div>
        </Panel>
      </div>

      <Panel title="Recent invoices and receipts">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Invoices</h3>
            <ul className="space-y-2 text-sm">
              {((data as any)?.invoices ?? []).slice(0, 5).map((row: any) => (
                <li key={row.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.invoice_number}</span>
                    <Pill tone={row.status === "issued" ? "warning" : "muted"}>{row.status}</Pill>
                  </div>
                  <p className="text-muted-foreground">
                    Balance due: {Number(row.balance_due ?? 0).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Receipts</h3>
            <ul className="space-y-2 text-sm">
              {((data as any)?.receipts ?? []).slice(0, 5).map((row: any) => (
                <li key={row.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.receipt_number}</span>
                    <Pill tone={row.status === "active" ? "success" : "muted"}>{row.status}</Pill>
                  </div>
                  <p className="text-muted-foreground">
                    Issued: {new Date(row.issued_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Create budget">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Financial year">
              <select
                required
                className={inputClass}
                value={budgetForm.financialYearId}
                onChange={(event) =>
                  setBudgetForm({ ...budgetForm, financialYearId: event.target.value })
                }
              >
                <option value="">Select year</option>
                {((data as any)?.years ?? []).map((year: any) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Budget title">
              <input
                required
                className={inputClass}
                value={budgetForm.title}
                onChange={(event) => setBudgetForm({ ...budgetForm, title: event.target.value })}
              />
            </Field>
            <Field label="Department">
              <input
                className={inputClass}
                value={budgetForm.departmentName}
                onChange={(event) =>
                  setBudgetForm({ ...budgetForm, departmentName: event.target.value })
                }
                placeholder="Optional"
              />
            </Field>
            <Field label="Proposed amount">
              <input
                required
                type="number"
                min="0.01"
                className={inputClass}
                value={budgetForm.proposedAmount}
                onChange={(event) =>
                  setBudgetForm({ ...budgetForm, proposedAmount: event.target.value })
                }
              />
            </Field>
          </div>
          <div className="mt-3">
            <Btn
              variant="accent"
              onClick={() => budgetMutation.mutate()}
              disabled={budgetMutation.isPending}
            >
              Create draft budget
            </Btn>
          </div>
        </Panel>

        <Panel title="Budgets">
          <div className="space-y-2">
            {((data as any)?.budgets ?? []).slice(0, 5).map((budget: any) => (
              <div key={budget.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{budget.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {budget.department_name || "School-wide"}
                    </p>
                  </div>
                  <Pill
                    tone={
                      budget.status === "approved" || budget.status === "active"
                        ? "success"
                        : "warning"
                    }
                  >
                    {budget.status}
                  </Pill>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Year: {budget.financial_year_id}</span>
                  <button
                    type="button"
                    className="font-medium text-accent"
                    onClick={() => approveBudgetMutation.mutate(budget.id)}
                    disabled={approveBudgetMutation.isPending}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="font-medium text-muted-foreground"
                    onClick={() => reviseBudgetMutation.mutate(budget)}
                    disabled={reviseBudgetMutation.isPending}
                  >
                    Revise
                  </button>
                </div>
              </div>
            ))}
            {((data as any)?.budgets ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No budgets yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Add supplier">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Supplier name">
              <input
                required
                className={inputClass}
                value={supplierForm.supplierName}
                onChange={(event) =>
                  setSupplierForm({ ...supplierForm, supplierName: event.target.value })
                }
              />
            </Field>
            <Field label="Contact person">
              <input
                className={inputClass}
                value={supplierForm.contactPerson}
                onChange={(event) =>
                  setSupplierForm({ ...supplierForm, contactPerson: event.target.value })
                }
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={supplierForm.phone}
                onChange={(event) =>
                  setSupplierForm({ ...supplierForm, phone: event.target.value })
                }
              />
            </Field>
          </div>
          <div className="mt-3">
            <Btn
              variant="accent"
              onClick={() => supplierMutation.mutate()}
              disabled={supplierMutation.isPending}
            >
              Save supplier
            </Btn>
          </div>
        </Panel>

        <Panel title="Purchase request">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Request number">
              <input
                required
                className={inputClass}
                value={requestForm.requestNumber}
                onChange={(event) =>
                  setRequestForm({ ...requestForm, requestNumber: event.target.value })
                }
              />
            </Field>
            <Field label="Budget">
              <select
                className={inputClass}
                value={requestForm.budgetId}
                onChange={(event) =>
                  setRequestForm({ ...requestForm, budgetId: event.target.value })
                }
              >
                <option value="">Select budget</option>
                {((data as any)?.budgets ?? []).map((budget: any) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select
                className={inputClass}
                value={requestForm.supplierId}
                onChange={(event) =>
                  setRequestForm({ ...requestForm, supplierId: event.target.value })
                }
              >
                <option value="">Select supplier</option>
                {((data as any)?.suppliers ?? []).map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <input
                className={inputClass}
                value={requestForm.departmentName}
                onChange={(event) =>
                  setRequestForm({ ...requestForm, departmentName: event.target.value })
                }
              />
            </Field>
            <Field label="Requested amount">
              <input
                required
                type="number"
                min="0.01"
                className={inputClass}
                value={requestForm.requestedAmount}
                onChange={(event) =>
                  setRequestForm({ ...requestForm, requestedAmount: event.target.value })
                }
              />
            </Field>
            <Field label="Item description">
              <input
                required
                className={inputClass}
                value={requestForm.itemDescription}
                onChange={(event) =>
                  setRequestForm({ ...requestForm, itemDescription: event.target.value })
                }
              />
            </Field>
          </div>
          <div className="mt-3">
            <Btn
              variant="accent"
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
            >
              Submit request
            </Btn>
          </div>
        </Panel>
      </div>

      <Panel title="Purchase requests">
        <div className="space-y-2">
        {scoped((data as any)?.purchaseRequests ?? []).slice(0, 5).map((request: any) => (
            <div key={request.id} className="rounded-xl border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{request.request_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.item_description}
                    {request.department_name ? ` · ${request.department_name}` : ""}
                  </p>
                </div>
                <Pill tone={request.approval_status === "approved" ? "success" : "warning"}>
                  {request.approval_status}
                </Pill>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Requested: {Number(request.requested_amount ?? 0).toLocaleString()}</span>
                <button
                  type="button"
                  className="font-medium text-accent"
                  onClick={() => reviewRequestMutation.mutate(request.id)}
                  disabled={reviewRequestMutation.isPending}
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
            {scoped((data as any)?.purchaseRequests ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No purchase requests yet.</p>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Order flow">
          <div className="space-y-3">
            <Field label="Purchase request">
              <select
                className={inputClass}
                value={procurementSelection.purchaseRequestId}
                onChange={(event) =>
                  setProcurementSelection({
                    ...procurementSelection,
                    purchaseRequestId: event.target.value,
                  })
                }
              >
                <option value="">Select request</option>
                {scoped((data as any)?.purchaseRequests ?? []).map((request: any) => (
                  <option key={request.id} value={request.id}>
                    {request.request_number} - {request.item_description}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select
                className={inputClass}
                value={procurementSelection.supplierId}
                onChange={(event) =>
                  setProcurementSelection({ ...procurementSelection, supplierId: event.target.value })
                }
              >
                <option value="">Select supplier</option>
                {((data as any)?.suppliers ?? []).map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Purchase order">
              <select
                className={inputClass}
                value={procurementSelection.purchaseOrderId}
                onChange={(event) =>
                  setProcurementSelection({
                    ...procurementSelection,
                    purchaseOrderId: event.target.value,
                  })
                }
              >
                <option value="">Select order</option>
                {scoped((data as any)?.purchaseOrders ?? []).map((order: any) => (
                  <option key={order.id} value={order.id}>
                    {order.order_number}
                  </option>
                ))}
              </select>
            </Field>
            <Btn variant="accent" onClick={() => orderMutation.mutate()} disabled={orderMutation.isPending}>
              Create purchase order
            </Btn>
            <Btn
              variant="accent"
              onClick={() => goodsReceiptMutation.mutate()}
              disabled={goodsReceiptMutation.isPending}
            >
              Record goods receipt
            </Btn>
          </div>
        </Panel>
        <Panel title="Invoice flow">
          <div className="space-y-3">
            <Field label="Supplier invoice">
              <select
                className={inputClass}
                value={procurementSelection.supplierInvoiceId}
                onChange={(event) =>
                  setProcurementSelection({
                    ...procurementSelection,
                    supplierInvoiceId: event.target.value,
                  })
                }
              >
                <option value="">Select invoice</option>
                {((data as any)?.supplierInvoices ?? []).map((invoice: any) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Voucher invoice">
              <select
                className={inputClass}
                value={procurementSelection.voucherInvoiceId}
                onChange={(event) =>
                  setProcurementSelection({
                    ...procurementSelection,
                    voucherInvoiceId: event.target.value,
                  })
                }
              >
                <option value="">Select invoice</option>
                {((data as any)?.supplierInvoices ?? []).map((invoice: any) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number}
                  </option>
                ))}
              </select>
            </Field>
            <Btn
              variant="accent"
              onClick={() => supplierInvoiceMutation.mutate()}
              disabled={supplierInvoiceMutation.isPending}
            >
              Create supplier invoice
            </Btn>
            <Btn
              variant="accent"
              onClick={() => invoiceReviewMutation.mutate()}
              disabled={invoiceReviewMutation.isPending}
            >
              Approve invoice
            </Btn>
          </div>
        </Panel>
        <Panel title="Voucher flow">
          <div className="space-y-3">
            <Field label="Payee supplier">
              <select
                className={inputClass}
                value={procurementSelection.supplierId}
                onChange={(event) =>
                  setProcurementSelection({ ...procurementSelection, supplierId: event.target.value })
                }
              >
                <option value="">Select supplier</option>
                {((data as any)?.suppliers ?? []).map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
            </Field>
            <Btn variant="accent" onClick={() => voucherMutation.mutate()} disabled={voucherMutation.isPending}>
              Create payment voucher
            </Btn>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Purchase orders">
          <div className="space-y-2">
            {((data as any)?.purchaseOrders ?? []).slice(0, 5).map((order: any) => (
              <div key={order.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{order.order_number}</p>
                  <Pill tone={order.status === "received" ? "success" : "warning"}>
                    {order.status}
                  </Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: {Number(order.total_amount ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
            {scoped((data as any)?.purchaseOrders ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
            )}
          </div>
        </Panel>
        <Panel title="Goods receipts">
          <div className="space-y-2">
            {scoped((data as any)?.goodsReceipts ?? []).slice(0, 5).map((receipt: any) => (
              <div key={receipt.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{receipt.receipt_number}</p>
                  <Pill tone="success">{receipt.status}</Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                  Received: {Number(receipt.items_received ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
            {scoped((data as any)?.goodsReceipts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No goods receipts yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Supplier invoices">
          <div className="space-y-2">
            {scoped((data as any)?.supplierInvoices ?? []).slice(0, 5).map((invoice: any) => (
              <div key={invoice.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{invoice.invoice_number}</p>
                  <Pill tone={invoice.approval_status === "approved" ? "success" : "warning"}>
                    {invoice.approval_status}
                  </Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                  Amount: {Number(invoice.amount ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
            {scoped((data as any)?.supplierInvoices ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No supplier invoices yet.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn
              variant="accent"
              onClick={() => invoiceReviewMutation.mutate()}
              disabled={invoiceReviewMutation.isPending}
            >
              Approve latest invoice
            </Btn>
          </div>
        </Panel>
        <Panel title="Payment vouchers">
          <div className="space-y-2">
            {scoped((data as any)?.paymentVouchers ?? []).slice(0, 5).map((voucher: any) => (
              <div key={voucher.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{voucher.voucher_number}</p>
                  <Pill tone={voucher.status === "approved" ? "success" : "warning"}>
                    {voucher.status}
                  </Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payee: {voucher.payee_name} · {Number(voucher.amount ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
            {scoped((data as any)?.paymentVouchers ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No payment vouchers yet.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn
              variant="accent"
              onClick={() => voucherMutation.mutate()}
              disabled={voucherMutation.isPending}
            >
              Create payment voucher
            </Btn>
          </div>
        </Panel>
      </div>
    </div>
  );
}


