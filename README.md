<<<<<<< HEAD
# School Connect
=======
# Education Track School Management System
>>>>>>> aba4fe8f3fe34a872f429f374700164ac11398b5

# Build a Multi-Tenant School Management & Report Card System

## Objective

Build a modern, secure, scalable **Multi-Tenant School Management System** where one platform serves multiple schools while keeping each school's data completely isolated.

The application should be production-ready, responsive, highly modular, and easy to extend.

---

# Technology Stack

Use the following technologies:

Frontend

* React

* TypeScript

* Vite

* Tailwind CSS

* React Router

* React Hook Form

* TanStack Query

* Zod Validation

* Recharts (for charts)

* React PDF (optional)

* Axios

Backend

* Node.js

* Express.js

* TypeScript

Database

* PostgreSQL

ORM

* Prisma ORM

Authentication

* JWT

* Refresh Tokens

* bcrypt/Argon2 Password Hashing

Storage

* Local Storage or Supabase Storage

* Images stored separately per school

Deployment Ready

* Docker support

* Environment variables

* REST API

---

# Architecture

The system must be built as a **multi-tenant application**.

Each school is a tenant.

Every table must contain a School ID so users only access records belonging to their school.

The Super Admin can access every school.

School users can access only their school's data.

---

# Authentication

There is only ONE signup page.

Only the Super Admin signs up.

No school can register itself.

Workflow

Super Admin

↓

Creates School

↓

Creates School Administrator

↓

System Generates One-Time Password

↓

School Administrator Logs In

↓

Must Change Password

↓

Access Dashboard

---

# User Roles

Implement Role-Based Access Control (RBAC).

Roles:

• Super Admin

• School Administrator

• Head Teacher

• Deputy Head Teacher

• Director of Studies (DOS)

• Class Teacher

• Subject Teacher

Every route, API, menu, and action must be permission-based.

---

# Super Admin

Can:

* Create schools

* Edit schools

* Suspend schools

* Activate schools

* Delete schools

* View platform analytics

* Create School Administrators

* Generate one-time passwords

* Reset School Administrator passwords

* Manage subscription plans

* View audit logs

* Manage global grading templates

* Manage report templates

---

# School Administrator

Can:

* Configure school information

* Upload school logo

* Create users

* Assign roles

* Reset passwords

* Enable or disable system modules

* Manage academic years

* Manage terms

* Manage classes

* Manage streams

* Manage subjects

* Manage grading systems

* Allocate teachers

* Verify students

* Create and edit student records

* Configure reports

---

# Head Teacher

Can:

* View all dashboards

* View reports

* Print reports

* Verify students

* Update student records

* View analytics

* View teacher performance

* View attendance

* View academic performance

* Sign reports

---

# Deputy Head Teacher

Must have the SAME permissions as the Head Teacher.

---

# Director of Studies (DOS)

Can:

* View all submitted assessments

* Approve assessments

* Reject assessments

* Return assessments for correction

* Lock approved assessments

* Print report cards

* Print class reports

* Print stream reports

* Print whole-school reports

* Monitor assessment completion

Important Rule:

Once marks are approved:

* Teachers CANNOT edit them.

* Marks become locked.

* Any change requires reopening by an authorized administrator with an audit trail.

---

# Class Teacher

Can:

* Register students

* Edit student information before verification

* Enter class comments

* Enter co-curricular activities

* View class reports

* Manage attendance

Student Registration Workflow:

Class Teacher

↓

Student Pending Verification

↓

Head Teacher OR School Administrator

↓

Verify Student

↓

Student Activated

Only verified students may appear in attendance, assessments, and reports.

---

# Subject Teacher

Can:

* Enter assessments

* Save drafts

* Submit marks

* Edit marks while pending approval

* View approval status

Cannot:

* Approve marks

* Edit approved marks

* Delete approved marks

---

# Assessment Workflow

Teacher

↓

Enter Marks

↓

Submit

↓

Pending DOS Approval

↓

DOS Reviews

↓

Approve or Reject

↓

If Approved

↓

Marks Locked

↓

Reports Generated

---

# Student Management

Student information includes:

* Student Number

* LIN

* Full Name

* Gender

* Date of Birth

* Passport Photo

* Parent Information

* Guardian Information

* Address

* Class

* Stream

* House

* Fees Balance

* Status

Student records can only be modified by:

* School Administrator

* Head Teacher

* Deputy Head Teacher (if granted equivalent rights)

Every change must be recorded in an audit log.

---

# School Branding

Every school uploads its own logo.

Logo automatically appears on:

* Report Cards

* Certificates

* Student IDs

* PDFs

* Portal

Logo Requirements:

Maximum size:

1 MB

Supported:

PNG

JPG

JPEG

SVG

---

# Student Photos

Every student has one passport photograph.

Photo Requirements:

Maximum upload:

1 MB

Supported:

PNG

JPG

JPEG

Automatically:

* Validate size

* Validate file type

* Resize

* Compress

* Generate thumbnails

Display on:

* Reports

* Student Profile

* Student ID

* Attendance

---

# Feature Toggle System

The School Administrator can enable or disable modules without changing code.

Modules include:

* Fees

* Attendance

* Library

* Transport

* Hostel

* Inventory

* SMS

* Parent Portal

* Discipline

* Report Cards

* Co-Curricular Activities

If a module is disabled:

* Hide its menus

* Disable its APIs

* Remove it from reports

Example:

If Fees is disabled:

* No Fees menu

* No Fees reports

* No Fees balance on report cards

---

# Report Card

Build a fully dynamic report card.

Nothing should be hardcoded.

Load from the database:

* School Information

* School Logo

* Student Information

* Passport Photo

* Attendance

* Subjects

* Formative Scores

* Summative Scores

* Total Scores

* Grades

* Grade Descriptors

* Teacher Initials

* Average

* Identifier

* Descriptor

* Co-curricular Activities

* Teacher Comment

* Head Teacher Comment

* Signatures

Backend performs all calculations.

Frontend only renders data.

---

# Bulk Printing

Allow printing:

* Single Student

* Entire Class

* Entire Stream

* Entire School

* Selected Students

Allow export to:

* PDF

* Print

* HTML

Reports should be A4 optimized.

---

# Dashboards

Provide interactive dashboards using Recharts.

Head Teacher / Deputy Dashboard

Include:

* Student Performance Trend

* Subject Performance

* Grade Distribution (Pie Chart)

* Attendance Trend

* Teacher Performance

* Class Comparison

* Stream Comparison

* Gender Distribution

* Assessment Completion

* Average Performance

* Top Performing Subjects

* Lowest Performing Subjects

DOS Dashboard

Show:

* Pending Approvals

* Approved Assessments

* Rejected Assessments

* Teachers Pending Submission

* Assessment Completion

* Average Scores

School Administrator Dashboard

Show:

* Students

* Teachers

* Users

* Active Modules

* Storage Usage

* Recent Activity

Super Admin Dashboard

Show:

* Total Schools

* Total Students

* Total Teachers

* Platform Usage

* Active Schools

* Suspended Schools

* Storage Statistics

* Subscription Statistics

---

# Notifications

Generate notifications for:

* New user created

* OTP generated

* Password reset

* Student awaiting verification

* Marks submitted

* Marks approved

* Marks rejected

* Report generated

---

# Security

Implement:

* JWT Authentication

* Refresh Tokens

* RBAC

* Password hashing

* OTP first login

* Session timeout

* Audit logs

* Soft deletes

* Login history

* School data isolation

* File validation

* API authorization

---

# Audit Logs

Record:

* Login

* Logout

* Password changes

* Student edits

* Assessment edits

* Assessment approvals

* Report generation

* Bulk printing

* User creation

* Role changes

Each log stores:

* User

* School

* Action

* Date

* Time

* IP Address

---

# Database

Design a normalized PostgreSQL database using Prisma with relationships, indexes, and migrations.

Include entities such as:

* Schools

* Users

* Roles

* Permissions

* Students

* Guardians

* Classes

* Streams

* Subjects

* Teacher Allocations

* Assessments

* Assessment Approvals

* Attendance

* Academic Years

* Terms

* Grading Systems

* Report Templates

* Feature Toggles

* Notifications

* Audit Logs

* File Uploads

---

# Code Quality

Generate:

* Clean architecture

* Modular folder structure

* Reusable React components

* Reusable API services

* Custom hooks

* Responsive UI

* Type-safe code

* Error handling

* Loading states

* Validation

* Pagination

* Search

* Filtering

* Sorting

---

# Deliverables

Generate the complete application including:

* Database schema

* Prisma models

* Backend APIs

* Authentication

* Role & Permission System

* React frontend

* Dashboards

* Dynamic Report Card

* Bulk Printing

* PDF Generation

* File Upload System

* Feature Toggle System

* Charts

* Audit Logs

* Notifications

* Responsive UI

* Docker configuration

* Seed data

* README

* API documentation

* Deployment instructions

The system should be enterprise-grade, maintainable, secure, scalable, and optimized for managing multiple schools from a single platform while ensuring complete data isolation between schools.

ATTACHED IS AN EXACT EXAMPLE OF THE REPORT THAT SYSTEM SHOULD OUTPUT AND IT SHOULD LOOK EXACTLY THE SAME.

# Build a Multi-Tenant School Management & Report Card System

## Objective

Build a modern, secure, scalable **Multi-Tenant School Management System** where one platform serves multiple schools while keeping each school's data completely isolated.

The application should be production-ready, responsive, highly modular, and easy to extend.

---

# Technology Stack

Use the following technologies:

Frontend

* React

* TypeScript

* Vite

* Tailwind CSS

* React Router

* React Hook Form

* TanStack Query

* Zod Validation

* Recharts (for charts)

* React PDF (optional)

* Axios

Backend

* Node.js

* Express.js

* TypeScript

Database

* PostgreSQL

ORM

* Prisma ORM

Authentication

* JWT

* Refresh Tokens

* bcrypt/Argon2 Password Hashing

Storage

* Local Storage or Supabase Storage

* Images stored separately per school

Deployment Ready

* Docker support

* Environment variables

* REST API

---

# Architecture

The system must be built as a **multi-tenant application**.

Each school is a tenant.

Every table must contain a School ID so users only access records belonging to their school.

The Super Admin can access every school.

School users can access only their school's data.

---

# Authentication

There is only ONE signup page.

Only the Super Admin signs up.

No school can register itself.

Workflow

Super Admin

↓

Creates School

↓

Creates School Administrator

↓

System Generates One-Time Password

↓

School Administrator Logs In

↓

Must Change Password

↓

Access Dashboard

---

# User Roles

Implement Role-Based Access Control (RBAC).

Roles:

• Super Admin

• School Administrator

• Head Teacher

• Deputy Head Teacher

• Director of Studies (DOS)

• Class Teacher

• Subject Teacher

Every route, API, menu, and action must be permission-based.

---

# Super Admin

Can:

* Create schools

* Edit schools

* Suspend schools

* Activate schools

* Delete schools

* View platform analytics

* Create School Administrators

* Generate one-time passwords

* Reset School Administrator passwords

* Manage subscription plans

* View audit logs

* Manage global grading templates

* Manage report templates

---

# School Administrator

Can:

* Configure school information

* Upload school logo

* Create users

* Assign roles

* Reset passwords

* Enable or disable system modules

* Manage academic years

* Manage terms

* Manage classes

* Manage streams

* Manage subjects

* Manage grading systems

* Allocate teachers

* Verify students

* Create and edit student records

* Configure reports

---

# Head Teacher

Can:

* View all dashboards

* View reports

* Print reports

* Verify students

* Update student records

* View analytics

* View teacher performance

* View attendance

* View academic performance

* Sign reports

---

# Deputy Head Teacher

Must have the SAME permissions as the Head Teacher.

---

# Director of Studies (DOS)

Can:

* View all submitted assessments

* Approve assessments

* Reject assessments

* Return assessments for correction

* Lock approved assessments

* Print report cards

* Print class reports

* Print stream reports

* Print whole-school reports

* Monitor assessment completion

Important Rule:

Once marks are approved:

* Teachers CANNOT edit them.

* Marks become locked.

* Any change requires reopening by an authorized administrator with an audit trail.

---

# Class Teacher

Can:

* Register students

* Edit student information before verification

* Enter class comments

* Enter co-curricular activities

* View class reports

* Manage attendance

Student Registration Workflow:

Class Teacher

↓

Student Pending Verification

↓

Head Teacher OR School Administrator

↓

Verify Student

↓

Student Activated

Only verified students may appear in attendance, assessments, and reports.

---

# Subject Teacher

Can:

* Enter assessments

* Save drafts

* Submit marks

* Edit marks while pending approval

* View approval status

Cannot:

* Approve marks

* Edit approved marks

* Delete approved marks

---

# Assessment Workflow

Teacher

↓

Enter Marks

↓

Submit

↓

Pending DOS Approval

↓

DOS Reviews

↓

Approve or Reject

↓

If Approved

↓

Marks Locked

↓

Reports Generated

---

# Student Management

Student information includes:

* Student Number

* LIN

* Full Name

* Gender

* Date of Birth

* Passport Photo

* Parent Information

* Guardian Information

* Address

* Class

* Stream

* House

* Fees Balance

* Status

Student records can only be modified by:

* School Administrator

* Head Teacher

* Deputy Head Teacher (if granted equivalent rights)

Every change must be recorded in an audit log.

---

# School Branding

Every school uploads its own logo.

Logo automatically appears on:

* Report Cards

* Certificates

* Student IDs

* PDFs

* Portal

Logo Requirements:

Maximum size:

1 MB

Supported:

PNG

JPG

JPEG

SVG

---

# Student Photos

Every student has one passport photograph.

Photo Requirements:

Maximum upload:

1 MB

Supported:

PNG

JPG

JPEG

Automatically:

* Validate size

* Validate file type

* Resize

* Compress

* Generate thumbnails

Display on:

* Reports

* Student Profile

* Student ID

* Attendance

---

# Feature Toggle System

The School Administrator can enable or disable modules without changing code.

Modules include:

* Fees

* Attendance

* Library

* Transport

* Hostel

* Inventory

* SMS

* Parent Portal

* Discipline

* Report Cards

* Co-Curricular Activities

If a module is disabled:

* Hide its menus

* Disable its APIs

* Remove it from reports

Example:

If Fees is disabled:

* No Fees menu

* No Fees reports

* No Fees balance on report cards

---

# Report Card

Build a fully dynamic report card.

Nothing should be hardcoded.

Load from the database:

* School Information

* School Logo

* Student Information

* Passport Photo

* Attendance

* Subjects

* Formative Scores

* Summative Scores

* Total Scores

* Grades

* Grade Descriptors

* Teacher Initials

* Average

* Identifier

* Descriptor

* Co-curricular Activities

* Teacher Comment

* Head Teacher Comment

* Signatures

Backend performs all calculations.

Frontend only renders data.

---

# Bulk Printing

Allow printing:

* Single Student

* Entire Class

* Entire Stream

* Entire School

* Selected Students

Allow export to:

* PDF

* Print

* HTML

Reports should be A4 optimized.

---

# Dashboards

Provide interactive dashboards using Recharts.

Head Teacher / Deputy Dashboard

Include:

* Student Performance Trend

* Subject Performance

* Grade Distribution (Pie Chart)

* Attendance Trend

* Teacher Performance

* Class Comparison

* Stream Comparison

* Gender Distribution

* Assessment Completion

* Average Performance

* Top Performing Subjects

* Lowest Performing Subjects

DOS Dashboard

Show:

* Pending Approvals

* Approved Assessments

* Rejected Assessments

* Teachers Pending Submission

* Assessment Completion

* Average Scores

School Administrator Dashboard

Show:

* Students

* Teachers

* Users

* Active Modules

* Storage Usage

* Recent Activity

Super Admin Dashboard

Show:

* Total Schools

* Total Students

* Total Teachers

* Platform Usage

* Active Schools

* Suspended Schools

* Storage Statistics

* Subscription Statistics

---

# Notifications

Generate notifications for:

* New user created

* OTP generated

* Password reset

* Student awaiting verification

* Marks submitted

* Marks approved

* Marks rejected

* Report generated

---

# Security

Implement:

* JWT Authentication

* Refresh Tokens

* RBAC

* Password hashing

* OTP first login

* Session timeout

* Audit logs

* Soft deletes

* Login history

* School data isolation

* File validation

* API authorization

---

# Audit Logs

Record:

* Login

* Logout

* Password changes

* Student edits

* Assessment edits

* Assessment approvals

* Report generation

* Bulk printing

* User creation

* Role changes

Each log stores:

* User

* School

* Action

* Date

* Time

* IP Address

---

# Database

Design a normalized PostgreSQL database using Prisma with relationships, indexes, and migrations.

Include entities such as:

* Schools

* Users

* Roles

* Permissions

* Students

* Guardians

* Classes

* Streams

* Subjects

* Teacher Allocations

* Assessments

* Assessment Approvals

* Attendance

* Academic Years

* Terms

* Grading Systems

* Report Templates

* Feature Toggles

* Notifications

* Audit Logs

* File Uploads

---

# Code Quality

Generate:

* Clean architecture

* Modular folder structure

* Reusable React components

* Reusable API services

* Custom hooks

* Responsive UI

* Type-safe code

* Error handling

* Loading states

* Validation

* Pagination

* Search

* Filtering

* Sorting

---

# Deliverables

Generate the complete application including:

* Database schema

* Prisma models

* Backend APIs

* Authentication

* Role & Permission System

* React frontend

* Dashboards

* Dynamic Report Card

* Bulk Printing

* PDF Generation

* File Upload System

* Feature Toggle System

* Charts

* Audit Logs

* Notifications

* Responsive UI

* Docker configuration

* Seed data

* README

* API documentation

* Deployment instructions

The system should be enterprise-grade, maintainable, secure, scalable, and optimized for managing multiple schools from a single platform while ensuring complete data isolation between schools.

USE COLOURS (60:30:10 USING WHITE:BLUE:ORANGE)

ATTACHED IS AN EXACT EXAMPLE OF THE REPORT THAT SYSTEM SHOULD OUTPUT AND IT SHOULD LOOK EXACTLY THE SAME.

An HTML file containing the exact report card design is attached to this prompt.

This report serves as the official template for the system and must be reproduced exactly.

The generated report should match the attached design in every aspect, including but not limited to:

Overall layout and page structure

A4 print dimensions

Header arrangement

Typography and font hierarchy

Colors

Borders and spacing

Tables

Section ordering

Alignment

Margins and padding

Responsive behavior

Print optimization

Styling and visual appearance

The final generated report should be visually indistinguishable from the attached template while remaining 100% dynamic.

The HTML template must never contain hardcoded student or school data. All information displayed on the report must be retrieved dynamically from the database at runtime.

Dynamic data includes:

School logo

School information

Student photograph

Student information

Attendance

Assessment results

Grades

Grade descriptors

Teacher initials

Overall averages

Comments

Co-curricular activities

Signatures

Any other report content

The backend is responsible for all calculations, grading, averages, descriptors, and report generation. The frontend template is responsible only for rendering the supplied data.

ATTACHED LOGO USE IT AS THE SYSTEM LOGO AND GENERATE A FAVICON FROM IT TO USE.

This logo is the official logo of the School Management System and is NOT a school logo.

Use this logo the application for system branding Do not use this logo on school report cards. Report cards must always display the individual school's uploaded logo TO THE SYSTEM BY THE SCHOOL.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/28cab1f5-2599-4926-9274-c1721aa960d6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
