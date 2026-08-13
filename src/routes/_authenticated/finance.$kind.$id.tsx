import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, inputClass } from "@/components/ui-kit";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import {
  updatePaymentVoucher,
  updatePurchaseOrder,
  updatePurchaseRequest,
  updateSupplierInvoice,
} from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

export const Route = createFileRoute("/_authenticated/finance/$kind/$id")({
  component: FinanceDetailPage,
});

function FinanceDetailPage() {
  const queryClient = useQueryClient();
  const { kind, id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canView = hasAny(me?.roles, ["head_teacher", "bursar", "hod"]);
  const db = supabase as any;
  const [note, setNote] = useState("");
  const isHod = hasAny(me?.roles, ["hod"]);

  const { data } = useQuery({
    queryKey: ["finance-detail", kind, id, schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const table =
        kind === "request"
          ? "purchase_requests"
          : kind === "order"
            ? "purchase_orders"
          : kind === "invoice"
            ? "approved_invoices"
            : "payment_vouchers";
      const { data: row } = await db.from(table).select("*").eq("id", id).eq("school_id", schoolId!).maybeSingle();
      const { data: departments } = await db
        .from("departments")
        .select("id, name")
        .eq("school_id", schoolId!);
      const myDepartment = (me?.profile as any)?.department_id
        ? departments?.find((dept: any) => dept.id === (me?.profile as any).department_id)?.name ?? null
        : null;
      if (isHod && myDepartment && row?.department_name !== myDepartment) return null;
      return row ?? null;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (kind === "request") {
        return updatePurchaseRequest({
          data: {
            requestId: id,
            requestNumber: data?.request_number,
            departmentName: data?.department_name,
            itemDescription: data?.item_description,
            requestedAmount: Number(data?.requested_amount ?? 0),
            remarks: note || data?.remarks || null,
          },
        });
      }
      if (kind === "order") {
        return updatePurchaseOrder({
          data: {
            orderId: id,
            orderNumber: data?.order_number,
            status: data?.status,
            expectedDeliveryDate: data?.expected_delivery_date,
            totalAmount: Number(data?.total_amount ?? 0),
            remarks: note || data?.remarks || null,
          },
        });
      }
      if (kind === "invoice") {
        return updateSupplierInvoice({
          data: {
            invoiceId: id,
            invoiceNumber: data?.invoice_number,
            approvalStatus: data?.approval_status,
            approvalNote: note || data?.approval_note || null,
            amount: Number(data?.amount ?? 0),
            dueDate: data?.due_date,
          },
        });
      }
      return updatePaymentVoucher({
        data: {
          voucherId: id,
          voucherNumber: data?.voucher_number,
          status: data?.status,
          payeeName: data?.payee_name,
          amount: Number(data?.amount ?? 0),
          paymentMethod: data?.payment_method,
          remarks: note || data?.remarks || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Record updated");
      queryClient.invalidateQueries({ queryKey: ["finance-detail", kind, id, schoolId] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  if (!canView) {
    return <PageHeader title="Finance record" description="You do not have permission to view this area." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance record"
        description={`Editing ${kind} ${id}`}
      />

      <Panel title="Record details">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Note / remarks">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label="Record id">
            <input className={inputClass} value={id} readOnly />
          </Field>
        </div>
        <div className="mt-3">
          <Btn variant="accent" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            Save changes
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
