import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, BookPlus, CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { hasAny, useCurrentUser, type AppRole } from "@/hooks/useCurrentUser";
import { isModuleEnabled } from "@/lib/modules";
import {
  Btn,
  Field,
  PageHeader,
  Panel,
  Pill,
  ResponsiveTable,
  Stat,
  inputClass,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/library")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "library"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Library · EduTrack" },
      {
        name: "description",
        content: "Manage books, copies and circulation across the school library.",
      },
      { property: "og:title", content: "Library · EduTrack" },
      { property: "og:description", content: "Library intake, lending and returns in one place." },
    ],
  }),
  component: LibraryPage,
});

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  shelf_location: string | null;
  total_copies: number;
  available_copies: number;
  status: string;
  created_at: string;
};

type LoanRow = {
  id: string;
  book_id: string;
  borrower_type: string;
  student_id: string | null;
  user_id: string | null;
  issued_at: string;
  due_at: string | null;
  returned_at: string | null;
  notes: string | null;
  books?: { title: string; author: string | null } | null;
  students?: { full_name: string } | null;
  profiles?: { full_name: string } | null;
};

function LibraryPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canManage = hasAny(me?.roles, [
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "dos",
    "librarian",
  ]);
  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    shelf_location: "",
    total_copies: "1",
  });
  const [loanForm, setLoanForm] = useState({
    book_id: "",
    borrower_type: "student",
    student_id: "",
    user_id: "",
    due_at: "",
    notes: "",
  });

  const { data } = useQuery({
    queryKey: ["library", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [books, loans, students, staff] = await Promise.all([
        supabase.from("library_books").select("*").order("updated_at", { ascending: false }),
        supabase
          .from("library_loans")
          .select(
            "*, books:book_id(title, author), students:student_id(full_name), profiles:user_id(full_name)",
          )
          .order("issued_at", { ascending: false }),
        supabase
          .from("students")
          .select("id, full_name, class_id, stream_id, status")
          .is("deleted_at", null)
          .order("full_name"),
        supabase.from("profiles").select("id, full_name, initials").order("full_name"),
      ]);

      return {
        books: (books.data ?? []) as BookRow[],
        loans: (loans.data ?? []) as LoanRow[],
        students: students.data ?? [],
        staff: staff.data ?? [],
      };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["library", schoolId] });

  const addBook = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!canManage) throw new Error("You do not have permission to manage library stock");
      const copies = Math.max(1, Number(bookForm.total_copies) || 1);
      const { error } = await supabase.from("library_books").insert({
        school_id: schoolId,
        title: bookForm.title.trim(),
        author: bookForm.author.trim() || null,
        isbn: bookForm.isbn.trim() || null,
        category: bookForm.category.trim() || null,
        shelf_location: bookForm.shelf_location.trim() || null,
        total_copies: copies,
        available_copies: copies,
        status: "available",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Book added");
      setBookForm({
        title: "",
        author: "",
        isbn: "",
        category: "",
        shelf_location: "",
        total_copies: "1",
      });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const issueLoan = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!canManage) throw new Error("You do not have permission to issue books");
      if (!loanForm.book_id) throw new Error("Choose a book");
      if (loanForm.borrower_type === "student" && !loanForm.student_id)
        throw new Error("Choose a learner");
      if (loanForm.borrower_type === "staff" && !loanForm.user_id)
        throw new Error("Choose a staff member");

      const { data: book, error: bookError } = await supabase
        .from("library_books")
        .select("id, available_copies, status")
        .eq("id", loanForm.book_id)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (bookError) throw new Error(bookError.message);
      if (!book) throw new Error("Selected book not found");
      if (Number(book.available_copies) <= 0) throw new Error("No available copies left");

      const { error: insertError } = await supabase.from("library_loans").insert({
        school_id: schoolId,
        book_id: loanForm.book_id,
        borrower_type: loanForm.borrower_type,
        student_id: loanForm.borrower_type === "student" ? loanForm.student_id : null,
        user_id: loanForm.borrower_type === "staff" ? loanForm.user_id : null,
        issued_by: me?.userId ?? null,
        due_at: loanForm.due_at || null,
        notes: loanForm.notes.trim() || null,
      });
      if (insertError) throw new Error(insertError.message);

      const { error: updateError } = await supabase
        .from("library_books")
        .update({
          available_copies: Math.max(0, Number(book.available_copies) - 1),
          status: Number(book.available_copies) - 1 > 0 ? "available" : "unavailable",
        })
        .eq("id", loanForm.book_id)
        .eq("school_id", schoolId);
      if (updateError) throw new Error(updateError.message);
    },
    onSuccess: () => {
      toast.success("Book issued");
      setLoanForm({
        book_id: "",
        borrower_type: "student",
        student_id: "",
        user_id: "",
        due_at: "",
        notes: "",
      });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const returnLoan = useMutation({
    mutationFn: async (loanId: string) => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!canManage) throw new Error("You do not have permission to return books");
      const { data: loan, error: loanError } = await supabase
        .from("library_loans")
        .select("id, book_id, returned_at")
        .eq("id", loanId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (loanError) throw new Error(loanError.message);
      if (!loan) throw new Error("Loan not found");
      if (loan.returned_at) throw new Error("This loan has already been returned");

      const { data: book, error: bookError } = await supabase
        .from("library_books")
        .select("available_copies, total_copies")
        .eq("id", loan.book_id)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (bookError) throw new Error(bookError.message);
      if (!book) throw new Error("Book not found");

      const { error: updateLoanError } = await supabase
        .from("library_loans")
        .update({ returned_at: new Date().toISOString() })
        .eq("id", loanId)
        .eq("school_id", schoolId);
      if (updateLoanError) throw new Error(updateLoanError.message);

      const restored = Math.min(Number(book.total_copies), Number(book.available_copies) + 1);
      const { error: updateBookError } = await supabase
        .from("library_books")
        .update({
          available_copies: restored,
          status: restored > 0 ? "available" : "unavailable",
        })
        .eq("id", loan.book_id)
        .eq("school_id", schoolId);
      if (updateBookError) throw new Error(updateBookError.message);
    },
    onSuccess: () => {
      toast.success("Book returned");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const books = data?.books ?? [];
  const loans = data?.loans ?? [];
  const activeLoans = loans.filter((loan) => !loan.returned_at);
  const overdueLoans = activeLoans.filter(
    (loan) => loan.due_at && new Date(loan.due_at) < new Date(),
  );
  const issuedTitles = new Set(activeLoans.map((loan) => loan.book_id));

  return (
    <div>
      <PageHeader
        title="Library"
        description="Track book stock, issue copies to learners or staff, and clear returns when they come back."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Books" value={books.length} />
        <Stat
          label="Available copies"
          value={books.reduce((sum, book) => sum + Number(book.available_copies), 0)}
        />
        <Stat label="Active loans" value={activeLoans.length} />
        <Stat label="Overdue loans" value={overdueLoans.length} hint="Due date passed" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="Library stock">
          <ResponsiveTable
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Title</th>
                      <th className="pb-2">Author</th>
                      <th className="pb-2">Copies</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((book) => (
                      <tr key={book.id} className="border-t border-border">
                        <td className="py-2.5 font-medium">{book.title}</td>
                        <td>{book.author ?? "—"}</td>
                        <td>
                          {book.available_copies}/{book.total_copies}
                        </td>
                        <td>{book.shelf_location ?? "—"}</td>
                        <td>
                          <Pill tone={book.available_copies > 0 ? "success" : "warning"}>
                            {book.status}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                    {books.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          Add your first book to start using the library module.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            }
            mobile={
              <>
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{book.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {book.author ?? "Unknown author"}
                        </p>
                      </div>
                      <Pill tone={book.available_copies > 0 ? "success" : "warning"}>
                        {book.status}
                      </Pill>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>
                        Copies: {book.available_copies}/{book.total_copies}
                      </span>
                      <span>Location: {book.shelf_location ?? "—"}</span>
                    </div>
                  </div>
                ))}
                {books.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                    Add your first book to start using the library module.
                  </div>
                )}
              </>
            }
          />

          <div className="mt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4" />
              Recent circulation
            </h3>
            <ResponsiveTable
              desktop={
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">Book</th>
                        <th className="pb-2">Borrower</th>
                        <th className="pb-2">Due</th>
                        <th className="pb-2">State</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {loans.map((loan) => {
                        const borrower =
                          loan.borrower_type === "student"
                            ? loan.students?.full_name
                            : loan.profiles?.full_name;
                        return (
                          <tr key={loan.id} className="border-t border-border">
                            <td className="py-2.5">
                              <div className="font-medium">
                                {loan.books?.title ?? "Unknown book"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {loan.books?.author ?? ""}
                              </div>
                            </td>
                            <td>{borrower ?? "Unknown borrower"}</td>
                            <td>{loan.due_at ?? "—"}</td>
                            <td>
                              {loan.returned_at ? (
                                <Pill tone="success">Returned</Pill>
                              ) : overdueLoans.some((entry) => entry.id === loan.id) ? (
                                <Pill tone="danger">Overdue</Pill>
                              ) : (
                                <Pill tone="warning">On loan</Pill>
                              )}
                            </td>
                            <td className="text-right">
                              {!loan.returned_at && (
                                <Btn variant="ghost" onClick={() => returnLoan.mutate(loan.id)}>
                                  Return
                                </Btn>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {loans.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-muted-foreground">
                            No loans recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              }
              mobile={
                <>
                  {loans.map((loan) => {
                    const borrower =
                      loan.borrower_type === "student"
                        ? loan.students?.full_name
                        : loan.profiles?.full_name;
                    return (
                      <div
                        key={loan.id}
                        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {loan.books?.title ?? "Unknown book"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {borrower ?? "Unknown borrower"}
                            </p>
                          </div>
                          {loan.returned_at ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Clock3 className="h-4 w-4 text-accent" />
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>Due: {loan.due_at ?? "—"}</span>
                          {!loan.returned_at && (
                            <Btn variant="ghost" onClick={() => returnLoan.mutate(loan.id)}>
                              Return
                            </Btn>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {loans.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                      No loans recorded yet.
                    </div>
                  )}
                </>
              }
            />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Add book">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                addBook.mutate();
              }}
            >
              <Field label="Title">
                <input
                  required
                  className={inputClass}
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                />
              </Field>
              <Field label="Author">
                <input
                  className={inputClass}
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                />
              </Field>
              <Field label="ISBN">
                <input
                  className={inputClass}
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <input
                  className={inputClass}
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                />
              </Field>
              <Field label="Shelf location">
                <input
                  className={inputClass}
                  value={bookForm.shelf_location}
                  onChange={(e) => setBookForm({ ...bookForm, shelf_location: e.target.value })}
                />
              </Field>
              <Field label="Copies">
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  value={bookForm.total_copies}
                  onChange={(e) => setBookForm({ ...bookForm, total_copies: e.target.value })}
                />
              </Field>
              <Btn type="submit" variant="accent" disabled={addBook.isPending || !canManage}>
                <BookPlus className="mr-2 h-4 w-4" />
                Add book
              </Btn>
            </form>
          </Panel>

          <Panel title="Issue book">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                issueLoan.mutate();
              }}
            >
              <Field label="Book">
                <select
                  className={inputClass}
                  value={loanForm.book_id}
                  onChange={(e) => setLoanForm({ ...loanForm, book_id: e.target.value })}
                >
                  <option value="">Select a book</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title} ({book.available_copies} available)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Borrower type">
                <select
                  className={inputClass}
                  value={loanForm.borrower_type}
                  onChange={(e) =>
                    setLoanForm({
                      ...loanForm,
                      borrower_type: e.target.value,
                      student_id: "",
                      user_id: "",
                    })
                  }
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                </select>
              </Field>
              {loanForm.borrower_type === "student" ? (
                <Field label="Student">
                  <select
                    className={inputClass}
                    value={loanForm.student_id}
                    onChange={(e) => setLoanForm({ ...loanForm, student_id: e.target.value })}
                  >
                    <option value="">Select learner</option>
                    {data?.students.map((student: { id: string; full_name: string }) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Staff member">
                  <select
                    className={inputClass}
                    value={loanForm.user_id}
                    onChange={(e) => setLoanForm({ ...loanForm, user_id: e.target.value })}
                  >
                    <option value="">Select staff</option>
                    {data?.staff.map((person: { id: string; full_name: string }) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Due date">
                <input
                  type="date"
                  className={inputClass}
                  value={loanForm.due_at}
                  onChange={(e) => setLoanForm({ ...loanForm, due_at: e.target.value })}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                />
              </Field>
              <Btn type="submit" variant="accent" disabled={issueLoan.isPending || !canManage}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Issue book
              </Btn>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
