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
  setSchoolFees,
  submitBudgetRevision,
  updateStudentPayCode,
  updateBudgetStatus,
} from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

type FinanceTab =
  | "overview"
  | "fees"
  | "pay-codes"
  | "collections"
  | "budgets"
  | "procurement"
  | "reports";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
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
  const canView = !!schoolId && hasAny(me?.roles, ["bursar"]);
  const canReviewFinance = hasAny(me?.roles, ["bursar"]);
  const canSetFees = hasAny(me?.roles, ["bursar"]);
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
  const [feeForm, setFeeForm] = useState<{
    scope: "class" | "student";
    classId: string;
    streamId: string;
    studentId: string;
    academicYearId: string;
    termId: string;
    feeName: string;
    amount: string;
  }>({
    scope: "class",
    classId: "",
    streamId: "",
    studentId: "",
    academicYearId: "",
    termId: "",
    feeName: "Tuition",
    amount: "0",
  });
  const [payCodeForm, setPayCodeForm] = useState({ studentId: "", schpayCode: "" });
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
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [feeSearch, setFeeSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["finance-dashboard", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [
        years,
        students,
        studentInvoices,
        academicYears,
        terms,
        classes,
        streams,
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
        db
          .from("students")
          .select("id, full_name, student_number, schpay_code, fees_balance, class_id, stream_id")
          .eq("school_id", schoolId!)
          .is("deleted_at", null)
          .order("full_name"),
        db
          .from("student_invoices")
          .select("*")
          .eq("school_id", schoolId!)
          .order("invoice_date", { ascending: false }),
        db
          .from("academic_years")
          .select("id, name, is_current")
          .eq("school_id", schoolId!)
          .order("name", { ascending: false }),
        db
          .from("terms")
          .select("id, name, academic_year_id, is_current")
          .eq("school_id", schoolId!)
          .order("name"),
        db.from("classes").select("id, name, education_level").eq("school_id", schoolId!).order("name"),
        db.from("streams").select("id, name, class_id").eq("school_id", schoolId!).order("name"),
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
        studentInvoices: studentInvoices.data ?? [],
        academicYears: academicYears.data ?? [],
        terms: terms.data ?? [],
        classes: classes.data ?? [],
        streams: streams.data ?? [],
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
    ? ((data?.departments ?? []).find((dept: any) => dept.id === (me?.profile as any).department_id)
        ?.name ?? null)
    : null;
  const isHod = hasAny(me?.roles, ["hod"]);
  const departmentTag = isHod ? myDepartment : null;
  const scoped = <T extends { department_name?: string | null }>(rows: T[]) =>
    isHod && myDepartment
      ? rows.filter((row) => (row.department_name ?? null) === myDepartment)
      : rows;
  const scopedBudgetIds = new Set(
    isHod && myDepartment
      ? (data?.budgets ?? [])
          .filter((budget: any) => (budget.department_name ?? null) === myDepartment)
          .map((budget: any) => budget.id)
      : (data?.budgets ?? []).map((budget: any) => budget.id),
  );
  const scopedBudgets =
    isHod && myDepartment
      ? (data?.budgets ?? []).filter(
          (budget: any) => (budget.department_name ?? null) === myDepartment,
        )
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
    payments: scopedPayments.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0),
    approvedBudget: scopedBudgetLines.reduce(
      (sum: number, row: any) => sum + Number(row.approved_amount ?? 0),
      0,
    ),
    revisedBudget: scopedBudgetLines.reduce(
      (sum: number, row: any) => sum + Number(row.revised_amount ?? 0),
      0,
    ),
    openOrders: scopedPurchaseOrders.filter((row: any) => row.status !== "received").length,
    pendingInvoices: scopedSupplierInvoices.filter((row: any) => row.approval_status === "pending")
      .length,
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

  const outstandingStudents = ((data?.students ?? []) as any[])
    .filter((student) => Number(student.fees_balance ?? 0) > 0)
    .filter((student) => {
      const query = feeSearch.trim().toLowerCase();
      return (
        !query ||
        String(student.full_name ?? "")
          .toLowerCase()
          .includes(query) ||
        String(student.student_number ?? "")
          .toLowerCase()
          .includes(query)
      );
    })
    .sort((a, b) => Number(b.fees_balance ?? 0) - Number(a.fees_balance ?? 0));
  const outstandingFees = ((data?.students ?? []) as any[]).reduce(
    (sum, student) => sum + Number(student.fees_balance ?? 0),
    0,
  );
  const paymentMethodTotals: Record<string, number> = {};
  for (const payment of scopedPayments as any[]) {
    const method = payment.payment_method || "other";
    paymentMethodTotals[method] = (paymentMethodTotals[method] ?? 0) + Number(payment.amount ?? 0);
  }
  const budgetUtilization: Record<
    string,
    { budget: number; actual: number; committed: number }
  > = {};
  for (const line of scopedBudgetLines as any[]) {
    const category = line.budget_category || "Uncategorised";
    const current = budgetUtilization[category] ?? { budget: 0, actual: 0, committed: 0 };
    current.budget += Number(
      line.approved_amount ?? line.revised_amount ?? line.proposed_amount ?? 0,
    );
    current.actual += Number(line.actual_amount ?? 0);
    current.committed += Number(line.committed_amount ?? 0);
    budgetUtilization[category] = current;
  }
  const currentAcademicYear = (data?.academicYears ?? []).find((year: any) => year.is_current);
  const selectedFeeYearId = feeForm.academicYearId || currentAcademicYear?.id || "";
  const currentTerm = (data?.terms ?? []).find(
    (term: any) => term.is_current && term.academic_year_id === selectedFeeYearId,
  );
  const selectedFeeTermId = feeForm.termId || currentTerm?.id || "";
  const feeStreams = ((data?.streams ?? []) as any[]).filter(
    (stream) => !feeForm.classId || stream.class_id === feeForm.classId,
  );

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
  const feeMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(feeForm.amount);
      if (!selectedFeeYearId) throw new Error("Select an academic year first");
      if (!selectedFeeTermId) throw new Error("Select a term first");
      if (!feeForm.feeName.trim()) throw new Error("Enter a fee name first");
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("School fees must be zero or greater");
      }
      if (feeForm.scope === "class" && !feeForm.classId) {
        throw new Error("Select a class before setting class fees");
      }
      if (feeForm.scope === "student" && !feeForm.studentId) {
        throw new Error("Select a learner before setting individual fees");
      }
      return setSchoolFees({
        data: {
          scope: feeForm.scope,
          classId: feeForm.scope === "class" ? feeForm.classId : null,
          streamId: feeForm.scope === "class" ? feeForm.streamId || null : null,
          studentId: feeForm.scope === "student" ? feeForm.studentId : null,
          academicYearId: selectedFeeYearId,
          termId: selectedFeeTermId,
          feeName: feeForm.feeName,
          amount,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`Fees set for ${result.learnerCount} learner${result.learnerCount === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const payCodeMutation = useMutation({
    mutationFn: async () => {
      if (!payCodeForm.studentId) throw new Error("Select a learner first");
      if (!payCodeForm.schpayCode.trim()) throw new Error("Enter the payment code");
      return updateStudentPayCode({ data: payCodeForm });
    },
    onSuccess: () => {
      toast.success("Learner payment code saved");
      setPayCodeForm({ studentId: "", schpayCode: "" });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
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
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Invoice amount must be greater than zero");
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
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Payment amount must be greater than zero");
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
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Proposed amount must be greater than zero");
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
      if (!procurementSelection.supplierId)
        throw new Error("Select a supplier before creating the invoice");
      if (!procurementSelection.purchaseOrderId)
        throw new Error("Select a purchase order before creating the invoice");
      const supplier = (data?.suppliers ?? []).find(
        (row: any) => row.id === procurementSelection.supplierId,
      );
      const purchaseOrder = (data?.purchaseOrders ?? []).find(
        (row: any) => row.id === procurementSelection.purchaseOrderId,
      );
      if (!supplier)
        throw new Error("The selected supplier is no longer available. Choose a supplier again");
      if (!purchaseOrder)
        throw new Error(
          "The selected purchase order is no longer available. Choose an order again",
        );
      const amount = Number(purchaseOrder.total_amount);
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("The purchase order has no valid amount");
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
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0)
        throw new Error("Requested amount must be greater than zero");
      if (
        requestForm.budgetId &&
        !(data?.budgets ?? []).some((budget: any) => budget.id === requestForm.budgetId)
      ) {
        throw new Error("The selected budget is no longer available. Choose a budget again");
      }
      if (
        requestForm.supplierId &&
        !(data?.suppliers ?? []).some((supplier: any) => supplier.id === requestForm.supplierId)
      ) {
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
      if (!procurementSelection.purchaseRequestId)
        throw new Error("Select a purchase request before creating the order");
      if (!procurementSelection.supplierId)
        throw new Error("Select a supplier before creating the order");
      const request = (data?.purchaseRequests ?? []).find(
        (row: any) => row.id === procurementSelection.purchaseRequestId,
      );
      const supplier = (data?.suppliers ?? []).find(
        (row: any) => row.id === procurementSelection.supplierId,
      );
      if (!request)
        throw new Error(
          "The selected purchase request is no longer available. Choose a request again",
        );
      if (!supplier)
        throw new Error("The selected supplier is no longer available. Choose a supplier again");
      const totalAmount = Number(request.requested_amount);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0)
        throw new Error("The purchase request has no valid amount");
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
      if (!procurementSelection.purchaseOrderId)
        throw new Error("Select a purchase order before recording goods received");
      const order = (data?.purchaseOrders ?? []).find(
        (row: any) => row.id === procurementSelection.purchaseOrderId,
      );
      if (!order)
        throw new Error(
          "The selected purchase order is no longer available. Choose an order again",
        );
      const itemsReceived = Number(order.total_amount);
      if (!Number.isFinite(itemsReceived) || itemsReceived <= 0)
        throw new Error("The purchase order has no valid received amount");
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
      if (!procurementSelection.supplierInvoiceId)
        throw new Error("Select a supplier invoice before approving it");
      if (
        !(data?.supplierInvoices ?? []).some(
          (invoice: any) => invoice.id === procurementSelection.supplierInvoiceId,
        )
      ) {
        throw new Error(
          "The selected supplier invoice is no longer available. Choose an invoice again",
        );
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
      if (!procurementSelection.voucherInvoiceId)
        throw new Error("Select an approved invoice before creating the voucher");
      if (!procurementSelection.supplierId)
        throw new Error("Select the payee supplier before creating the voucher");
      const invoice = (data?.supplierInvoices ?? []).find(
        (row: any) => row.id === procurementSelection.voucherInvoiceId,
      );
      const supplier = (data?.suppliers ?? []).find(
        (row: any) => row.id === procurementSelection.supplierId,
      );
      if (!invoice)
        throw new Error("The selected invoice is no longer available. Choose an invoice again");
      if (!supplier)
        throw new Error("The selected supplier is no longer available. Choose a supplier again");
      const amount = Number(invoice.amount);
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("The invoice has no valid amount");
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
        eyebrow="School finance"
        description={`${me?.school?.name ?? "Your school"} · Manage collections, budgets, procurement and school cash flow from one workspace.`}
      />

      <div className="rounded-2xl border border-primary/15 bg-primary-soft px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">School-scoped finance</p>
            <p className="text-muted-foreground">
              You are viewing financial records for {me?.school?.name ?? "your assigned school"}{" "}
              only.
            </p>
          </div>
          <Pill tone="success">
            Bursar workspace
          </Pill>
        </div>
      </div>

      <nav
        aria-label="Finance sections"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-card)]"
      >
        {(
          [
            ["overview", "Overview"],
            ["fees", "Set school fees"],
            ["pay-codes", "Payment codes"],
            ["collections", "Fees & collections"],
            ["budgets", "Budgets"],
            ["procurement", "Procurement"],
            ["reports", "Reports"],
          ] as Array<[FinanceTab, string]>
        )
          .filter(([tab]) => tab !== "fees" || canSetFees)
          .map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-primary-soft hover:text-primary"
            }`}
            aria-current={activeTab === tab ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className={activeTab === "overview" ? "space-y-4" : "hidden"}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Cash balance" value={totals.cashBalance.toLocaleString()} />
          <Stat label="Income" value={totals.income.toLocaleString()} />
          <Stat label="Expenditure" value={totals.expenditure.toLocaleString()} />
          <Stat label="Approved budget" value={totals.approvedBudget.toLocaleString()} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Outstanding fees"
            value={outstandingFees.toLocaleString()}
            hint="Across active learners"
          />
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
      </div>

      <div className={activeTab === "fees" ? "space-y-4" : "hidden"}>
        {!canSetFees ? (
          <Panel title="Set school fees">
            <p className="text-sm text-muted-foreground">
              Only the bursar can set learner fees.
            </p>
          </Panel>
        ) : (
          <>
            <Panel title="Set school fees">
              <p className="mb-4 text-sm text-muted-foreground">
                Set a fee for every active learner in a class or for one learner. The resulting
                balance is posted to that learner&apos;s report card.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <Btn
                  variant={feeForm.scope === "class" ? "accent" : "ghost"}
                  onClick={() => setFeeForm({ ...feeForm, scope: "class", studentId: "" })}
                >
                  Whole class
                </Btn>
                <Btn
                  variant={feeForm.scope === "student" ? "accent" : "ghost"}
                  onClick={() => setFeeForm({ ...feeForm, scope: "student", classId: "", streamId: "" })}
                >
                  Individual learner
                </Btn>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Academic year">
                  <select
                    className={inputClass}
                    value={feeForm.academicYearId || selectedFeeYearId}
                    onChange={(event) =>
                      setFeeForm({ ...feeForm, academicYearId: event.target.value, termId: "" })
                    }
                  >
                    <option value="">Select year</option>
                    {((data as any)?.academicYears ?? []).map((year: any) => (
                      <option key={year.id} value={year.id}>
                        {year.name}{year.is_current ? " (Current)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Term">
                  <select
                    className={inputClass}
                    value={feeForm.termId || selectedFeeTermId}
                    onChange={(event) => setFeeForm({ ...feeForm, termId: event.target.value })}
                  >
                    <option value="">Select term</option>
                    {((data as any)?.terms ?? [])
                      .filter((term: any) => !selectedFeeYearId || term.academic_year_id === selectedFeeYearId)
                      .map((term: any) => (
                        <option key={term.id} value={term.id}>
                          {term.name}{term.is_current ? " (Current)" : ""}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Fee name">
                  <input
                    className={inputClass}
                    value={feeForm.feeName}
                    onChange={(event) => setFeeForm({ ...feeForm, feeName: event.target.value })}
                    placeholder="Tuition"
                  />
                </Field>
                <Field label="Amount">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeForm.amount}
                    onChange={(event) => setFeeForm({ ...feeForm, amount: event.target.value })}
                  />
                </Field>
                {feeForm.scope === "class" ? (
                  <>
                    <Field label="Class">
                      <select
                        className={inputClass}
                        value={feeForm.classId}
                        onChange={(event) =>
                          setFeeForm({ ...feeForm, classId: event.target.value, streamId: "" })
                        }
                      >
                        <option value="">Select class</option>
                        {((data as any)?.classes ?? []).map((classRow: any) => (
                          <option key={classRow.id} value={classRow.id}>{classRow.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Stream (optional)">
                      <select
                        className={inputClass}
                        value={feeForm.streamId}
                        onChange={(event) => setFeeForm({ ...feeForm, streamId: event.target.value })}
                      >
                        <option value="">All streams in class</option>
                        {feeStreams.map((stream: any) => (
                          <option key={stream.id} value={stream.id}>{stream.name}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : (
                  <Field label="Learner" className="md:col-span-2">
                    <select
                      className={inputClass}
                      value={feeForm.studentId}
                      onChange={(event) => setFeeForm({ ...feeForm, studentId: event.target.value })}
                    >
                      <option value="">Select learner</option>
                      {((data as any)?.students ?? []).map((student: any) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name}{student.student_number ? ` · ${student.student_number}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Btn variant="accent" onClick={() => feeMutation.mutate()} disabled={feeMutation.isPending}>
                  {feeMutation.isPending ? "Posting fees..." : "Post school fees"}
                </Btn>
                <span className="text-xs text-muted-foreground">
                  This updates the report-card fee balance for the selected learner scope.
                </span>
              </div>
            </Panel>
            <Panel title="Fee management notes">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-xl border border-border p-3">
                  <p className="font-semibold">Class setup</p>
                  <p className="mt-1 text-muted-foreground">Apply the same fee to every active learner in a class, with an optional stream filter.</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="font-semibold">Individual adjustments</p>
                  <p className="mt-1 text-muted-foreground">Use the individual mode for scholarships, negotiated fees, or special cases.</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="font-semibold">Report cards</p>
                  <p className="mt-1 text-muted-foreground">Generated reports read the updated balance from the finance record.</p>
                </div>
              </div>
            </Panel>
          </>
        )}
      </div>

      <div className={activeTab === "pay-codes" ? "space-y-4" : "hidden"}>
        <Panel title="Assign learner payment code">
          <p className="mb-4 text-sm text-muted-foreground">
            Each learner has one unique SchPay code. Codes are assigned and maintained by the bursar.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Learner">
              <select
                className={inputClass}
                value={payCodeForm.studentId}
                onChange={(event) => {
                  const student = ((data?.students ?? []) as any[]).find(
                    (item) => item.id === event.target.value,
                  );
                  setPayCodeForm({
                    studentId: event.target.value,
                    schpayCode: student?.schpay_code ?? "",
                  });
                }}
              >
                <option value="">Select learner</option>
                {((data?.students ?? []) as any[]).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                    {student.student_number ? ` · ${student.student_number}` : ""}
                    {student.schpay_code ? ` · ${student.schpay_code}` : " · No code assigned"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="SchPay code">
              <input
                className={inputClass}
                value={payCodeForm.schpayCode}
                onChange={(event) =>
                  setPayCodeForm({ ...payCodeForm, schpayCode: event.target.value.toUpperCase() })
                }
                placeholder="Enter unique payment code"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Btn variant="accent" onClick={() => payCodeMutation.mutate()} disabled={payCodeMutation.isPending}>
              {payCodeMutation.isPending ? "Saving code..." : "Save payment code"}
            </Btn>
          </div>
        </Panel>
      </div>

      <div className={activeTab === "collections" ? "space-y-4" : "hidden"}>
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
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
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
                  onChange={(event) =>
                    setInvoiceForm({ ...invoiceForm, amount: event.target.value })
                  }
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
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
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
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, amount: event.target.value })
                  }
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
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Outstanding fees</h3>
                <span className="text-xs font-semibold text-accent">
                  {outstandingFees.toLocaleString()}
                </span>
              </div>
              <input
                className={inputClass}
                value={feeSearch}
                onChange={(event) => setFeeSearch(event.target.value)}
                placeholder="Search learner or admission number"
                aria-label="Search outstanding fees"
              />
              <ul className="mt-3 space-y-2 text-sm">
                {outstandingStudents.slice(0, 6).map((student: any) => (
                  <li key={student.id} className="rounded-xl border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{student.full_name}</span>
                        <p className="text-xs text-muted-foreground">
                          {student.student_number || "No admission number"}
                        </p>
                      </div>
                      <span className="font-semibold text-accent">
                        {Number(student.fees_balance ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
                {outstandingStudents.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border px-3 py-4 text-muted-foreground">
                    No outstanding learner balances match this search.
                  </li>
                )}
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

        <Panel title="Recent learner invoices">
          <div className="space-y-2">
            {((data as any)?.studentInvoices ?? []).slice(0, 8).map((invoice: any) => {
              const student = ((data as any)?.students ?? []).find(
                (row: any) => row.id === invoice.student_id,
              );
              return (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {student?.full_name || "Learner"} · {invoice.invoice_date || "No date"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {Number(invoice.total_amount ?? 0).toLocaleString()}
                    </p>
                    <Pill tone={Number(invoice.balance_due ?? 0) > 0 ? "warning" : "success"}>
                      {Number(invoice.balance_due ?? 0) > 0
                        ? `Due ${Number(invoice.balance_due ?? 0).toLocaleString()}`
                        : "Paid"}
                    </Pill>
                  </div>
                </div>
              );
            })}
            {((data as any)?.studentInvoices ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No learner invoices have been created yet.
              </p>
            )}
          </div>
        </Panel>
      </div>
      <div className={activeTab === "budgets" ? "space-y-4" : "hidden"}>
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
      </div>
      <div className={activeTab === "procurement" ? "space-y-4" : "hidden"}>
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
            {scoped((data as any)?.purchaseRequests ?? [])
              .slice(0, 5)
              .map((request: any) => (
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
                    {canReviewFinance && (
                      <button
                        type="button"
                        className="font-medium text-accent"
                        onClick={() => reviewRequestMutation.mutate(request.id)}
                        disabled={reviewRequestMutation.isPending}
                      >
                        Approve
                      </button>
                    )}
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
                    setProcurementSelection({
                      ...procurementSelection,
                      supplierId: event.target.value,
                    })
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
              <Btn
                variant="accent"
                onClick={() => orderMutation.mutate()}
                disabled={orderMutation.isPending}
              >
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
              {canReviewFinance && (
                <Btn
                  variant="accent"
                  onClick={() => invoiceReviewMutation.mutate()}
                  disabled={invoiceReviewMutation.isPending}
                >
                  Approve invoice
                </Btn>
              )}
            </div>
          </Panel>
          <Panel title="Voucher flow">
            <div className="space-y-3">
              <Field label="Payee supplier">
                <select
                  className={inputClass}
                  value={procurementSelection.supplierId}
                  onChange={(event) =>
                    setProcurementSelection({
                      ...procurementSelection,
                      supplierId: event.target.value,
                    })
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
              {scoped((data as any)?.goodsReceipts ?? [])
                .slice(0, 5)
                .map((receipt: any) => (
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
              {scoped((data as any)?.supplierInvoices ?? [])
                .slice(0, 5)
                .map((invoice: any) => (
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
              {canReviewFinance && (
                <Btn
                  variant="accent"
                  onClick={() => invoiceReviewMutation.mutate()}
                  disabled={invoiceReviewMutation.isPending}
                >
                  Approve latest invoice
                </Btn>
              )}
            </div>
          </Panel>
          <Panel title="Payment vouchers">
            <div className="space-y-2">
              {scoped((data as any)?.paymentVouchers ?? [])
                .slice(0, 5)
                .map((voucher: any) => (
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

      <div className={activeTab === "reports" ? "space-y-4" : "hidden"}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Collected from learners"
            value={totals.payments.toLocaleString()}
            hint="Posted payments"
          />
          <Stat
            label="Outstanding fees"
            value={outstandingFees.toLocaleString()}
            hint="Current learner balances"
          />
          <Stat
            label="Committed spend"
            value={spendData
              .slice(1)
              .reduce((sum, row) => sum + row.value, 0)
              .toLocaleString()}
          />
          <Stat
            label="Pending approvals"
            value={(
              totals.pendingInvoices +
              scoped((data?.purchaseRequests ?? []) as any[]).filter(
                (row: any) => row.approval_status === "pending",
              ).length
            ).toString()}
          />
        </div>

        <Panel title="Budget utilisation by category">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 text-right font-semibold">Budget</th>
                  <th className="px-3 py-3 text-right font-semibold">Committed</th>
                  <th className="px-3 py-3 text-right font-semibold">Actual</th>
                  <th className="px-3 py-3 text-right font-semibold">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(budgetUtilization).map(([category, values]) => {
                  const remaining = values.budget - values.actual - values.committed;
                  return (
                    <tr key={category} className="border-b border-border/70 last:border-0">
                      <td className="px-3 py-3 font-medium">{category}</td>
                      <td className="px-3 py-3 text-right">{values.budget.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">{values.committed.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">{values.actual.toLocaleString()}</td>
                      <td
                        className={`px-3 py-3 text-right font-semibold ${remaining < 0 ? "text-destructive" : "text-success"}`}
                      >
                        {remaining.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {Object.keys(budgetUtilization).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No budget line data is available for this school yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Collections by payment method">
            <div className="space-y-3">
              {Object.entries(paymentMethodTotals).map(([method, amount]) => (
                <div key={method}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="capitalize">{method.replaceAll("_", " ")}</span>
                    <span className="font-semibold">{amount.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${totals.payments ? Math.min(100, (amount / totals.payments) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {Object.keys(paymentMethodTotals).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No learner payments have been posted yet.
                </p>
              )}
            </div>
          </Panel>
          <Panel title="Recent school transactions">
            <div className="space-y-2">
              {scopedTransactions.slice(0, 8).map((transaction: any) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{transaction.transaction_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.narration || transaction.source_module}
                    </p>
                  </div>
                  <span
                    className={
                      transaction.transaction_type === "expense"
                        ? "font-semibold text-destructive"
                        : "font-semibold text-success"
                    }
                  >
                    {transaction.transaction_type === "expense" ? "−" : "+"}
                    {Number(transaction.total_amount ?? 0).toLocaleString()}
                  </span>
                </div>
              ))}
              {scopedTransactions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No transactions have been posted yet.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
