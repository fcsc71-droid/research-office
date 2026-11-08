-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ADMIN_REVIEW', 'UNDER_REVIEW', 'NEEDS_REVISION', 'RESUBMITTED', 'ACCEPTED', 'REJECTED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResearchType" AS ENUM ('GRADUATION_PROJECT', 'MASTER_THESIS', 'PHD_DISSERTATION', 'JOURNAL_ARTICLE', 'CONFERENCE_PAPER', 'FUNDED_PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResearchLevel" AS ENUM ('UNDERGRADUATE', 'DIPLOMA', 'MASTER', 'DOCTORATE', 'FACULTY');

-- CreateEnum
CREATE TYPE "AcademicDegree" AS ENUM ('BACHELOR_STUDENT', 'BACHELOR', 'MASTER_STUDENT', 'MASTER', 'PHD_STUDENT', 'PHD', 'LECTURER', 'ASSISTANT_PROFESSOR', 'ASSOCIATE_PROFESSOR', 'PROFESSOR');

-- CreateEnum
CREATE TYPE "ResearcherType" AS ENUM ('STUDENT', 'FACULTY', 'STAFF', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AuthorRole" AS ENUM ('MAIN', 'CO_AUTHOR');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('MAIN_DOCUMENT', 'REVISED_DOCUMENT', 'ATTACHMENT', 'DATA', 'PRESENTATION', 'IMAGE', 'REVIEW_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('NOTE', 'REVISION_REQUEST', 'RESEARCHER_REPLY', 'DECISION', 'INTERNAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_SUBMISSION', 'STATUS_CHANGED', 'REVIEWER_ASSIGNED', 'COMMENT_ADDED', 'REVISION_REQUESTED', 'DECISION', 'DEADLINE', 'REVIEW_SUBMITTED', 'SYSTEM');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "academicTitle" TEXT,
    "specialization" TEXT,
    "institution" TEXT,
    "collegeId" TEXT,
    "departmentId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colleges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "collegeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researchers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "type" "ResearcherType" NOT NULL DEFAULT 'STUDENT',
    "collegeId" TEXT,
    "departmentId" TEXT,
    "specialization" TEXT,
    "academicDegree" "AcademicDegree" NOT NULL DEFAULT 'BACHELOR_STUDENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "researchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_papers" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "abstract" TEXT NOT NULL,
    "keywords" TEXT[],
    "mainResearcherId" TEXT NOT NULL,
    "collegeId" TEXT,
    "departmentId" TEXT,
    "categoryId" TEXT,
    "specialization" TEXT,
    "supervisorName" TEXT,
    "type" "ResearchType" NOT NULL DEFAULT 'OTHER',
    "level" "ResearchLevel" NOT NULL DEFAULT 'UNDERGRADUATE',
    "status" "ResearchStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "publicationInfo" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_authors" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "researcherId" TEXT,
    "name" TEXT NOT NULL,
    "affiliation" TEXT,
    "role" "AuthorRole" NOT NULL DEFAULT 'CO_AUTHOR',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "research_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_versions" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_files" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "versionId" TEXT,
    "category" "FileCategory" NOT NULL DEFAULT 'ATTACHMENT',
    "title" TEXT,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "replacesId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentId" TEXT,

    CONSTRAINT "research_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_assignments" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "instructions" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_reviews" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "methodologyScore" INTEGER NOT NULL,
    "referencesScore" INTEGER NOT NULL,
    "resultsScore" INTEGER NOT NULL,
    "originalityScore" INTEGER NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "commentsToAuthor" TEXT NOT NULL,
    "confidentialComments" TEXT,
    "recommendation" "ReviewRecommendation" NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_comments" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "CommentType" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_status_history" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "fromStatus" "ResearchStatus",
    "toStatus" "ResearchStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_name_key" ON "colleges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_code_key" ON "colleges"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_collegeId_name_key" ON "departments"("collegeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "research_categories_name_key" ON "research_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "researchers_userId_key" ON "researchers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "researchers_universityId_key" ON "researchers"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "researchers_email_key" ON "researchers"("email");

-- CreateIndex
CREATE INDEX "researchers_collegeId_idx" ON "researchers"("collegeId");

-- CreateIndex
CREATE INDEX "researchers_departmentId_idx" ON "researchers"("departmentId");

-- CreateIndex
CREATE INDEX "researchers_fullName_idx" ON "researchers"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "research_papers_referenceNo_key" ON "research_papers"("referenceNo");

-- CreateIndex
CREATE INDEX "research_papers_status_idx" ON "research_papers"("status");

-- CreateIndex
CREATE INDEX "research_papers_collegeId_idx" ON "research_papers"("collegeId");

-- CreateIndex
CREATE INDEX "research_papers_departmentId_idx" ON "research_papers"("departmentId");

-- CreateIndex
CREATE INDEX "research_papers_categoryId_idx" ON "research_papers"("categoryId");

-- CreateIndex
CREATE INDEX "research_papers_submittedAt_idx" ON "research_papers"("submittedAt");

-- CreateIndex
CREATE INDEX "research_papers_createdAt_idx" ON "research_papers"("createdAt");

-- CreateIndex
CREATE INDEX "research_papers_mainResearcherId_idx" ON "research_papers"("mainResearcherId");

-- CreateIndex
CREATE INDEX "research_authors_paperId_idx" ON "research_authors"("paperId");

-- CreateIndex
CREATE INDEX "research_authors_researcherId_idx" ON "research_authors"("researcherId");

-- CreateIndex
CREATE UNIQUE INDEX "research_versions_paperId_versionNo_key" ON "research_versions"("paperId", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "research_files_storageKey_key" ON "research_files"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "research_files_replacesId_key" ON "research_files"("replacesId");

-- CreateIndex
CREATE INDEX "research_files_paperId_isCurrent_idx" ON "research_files"("paperId", "isCurrent");

-- CreateIndex
CREATE INDEX "review_assignments_reviewerId_status_idx" ON "review_assignments"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "review_assignments_dueDate_idx" ON "review_assignments"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "review_assignments_paperId_reviewerId_round_key" ON "review_assignments"("paperId", "reviewerId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "research_reviews_assignmentId_key" ON "research_reviews"("assignmentId");

-- CreateIndex
CREATE INDEX "research_comments_paperId_createdAt_idx" ON "research_comments"("paperId", "createdAt");

-- CreateIndex
CREATE INDEX "research_status_history_paperId_createdAt_idx" ON "research_status_history"("paperId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researchers" ADD CONSTRAINT "researchers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researchers" ADD CONSTRAINT "researchers_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researchers" ADD CONSTRAINT "researchers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_papers" ADD CONSTRAINT "research_papers_mainResearcherId_fkey" FOREIGN KEY ("mainResearcherId") REFERENCES "researchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_papers" ADD CONSTRAINT "research_papers_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_papers" ADD CONSTRAINT "research_papers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_papers" ADD CONSTRAINT "research_papers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "research_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_papers" ADD CONSTRAINT "research_papers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_authors" ADD CONSTRAINT "research_authors_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "research_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_authors" ADD CONSTRAINT "research_authors_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_versions" ADD CONSTRAINT "research_versions_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "research_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_versions" ADD CONSTRAINT "research_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_files" ADD CONSTRAINT "research_files_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "research_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_files" ADD CONSTRAINT "research_files_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "research_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_files" ADD CONSTRAINT "research_files_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "research_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_files" ADD CONSTRAINT "research_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_files" ADD CONSTRAINT "research_files_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "review_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "research_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_reviews" ADD CONSTRAINT "research_reviews_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_comments" ADD CONSTRAINT "research_comments_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "research_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_comments" ADD CONSTRAINT "research_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_status_history" ADD CONSTRAINT "research_status_history_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "research_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_status_history" ADD CONSTRAINT "research_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
