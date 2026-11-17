-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "RecordKind" AS ENUM ('SUBMISSION', 'PUBLISHED_RECORD');

-- CreateEnum
CREATE TYPE "IndexingType" AS ENUM ('SCOPUS', 'WOS', 'SCOPUS_WOS', 'OTHER', 'NONE');

-- CreateEnum
CREATE TYPE "Quartile" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'NONE');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('ORIGINAL', 'REVIEW', 'CASE_STUDY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PROPOSAL', 'UNDER_REVIEW', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONFERENCE', 'SEMINAR', 'WORKSHOP', 'LECTURE', 'TRAINING', 'SCIENTIFIC_DAY', 'EXHIBITION', 'DEPARTMENT_MEETING');

-- CreateEnum
CREATE TYPE "EventScope" AS ENUM ('LOCAL', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "ParticipationRole" AS ENUM ('ATTENDANCE', 'PRESENTER', 'SESSION_CHAIR', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('LIBYAN_UNIVERSITY', 'INTERNATIONAL_UNIVERSITY', 'RESEARCH_CENTER', 'SCIENTIFIC_INSTITUTION', 'GOVERNMENT', 'INDUSTRY');

-- CreateEnum
CREATE TYPE "CollaborationType" AS ENUM ('MOU', 'AGREEMENT', 'JOINT_PROJECT', 'JOINT_RESEARCH');

-- CreateEnum
CREATE TYPE "AwardType" AS ENUM ('BEST_PAPER', 'CONFERENCE', 'INNOVATION', 'PATENT', 'EXCELLENCE', 'ACADEMIC', 'OTHER');

-- AlterTable
ALTER TABLE "research_papers" ADD COLUMN     "articleType" "ArticleType" NOT NULL DEFAULT 'ORIGINAL',
ADD COLUMN     "doi" TEXT,
ADD COLUMN     "indexing" "IndexingType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "journalId" TEXT,
ADD COLUMN     "journalName" TEXT,
ADD COLUMN     "publicationYear" INTEGER,
ADD COLUMN     "recordKind" "RecordKind" NOT NULL DEFAULT 'SUBMISSION',
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "researchers" ADD COLUMN     "generalSpecialization" TEXT,
ADD COLUMN     "googleScholar" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "orcid" TEXT,
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "qualificationYear" INTEGER,
ADD COLUMN     "researchGate" TEXT,
ADD COLUMN     "researchInterests" TEXT[],
ADD COLUMN     "scopusId" TEXT;

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "issn" TEXT,
    "url" TEXT,
    "indexing" "IndexingType" NOT NULL DEFAULT 'NONE',
    "quartile" "Quartile" NOT NULL DEFAULT 'NONE',
    "field" TEXT,
    "indexingVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "departmentId" TEXT,
    "objectives" TEXT,
    "summary" TEXT,
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'PROPOSAL',
    "expectedOutputs" TEXT,
    "actualOutputs" TEXT,
    "partners" TEXT,
    "reportEveryMonths" INTEGER,
    "nextReportDue" TIMESTAMP(3),
    "approval" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "researcherId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scientific_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "scope" "EventScope" NOT NULL DEFAULT 'LOCAL',
    "organizedByInstitute" BOOLEAN NOT NULL DEFAULT false,
    "organizer" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "url" TEXT,
    "attendeesCount" INTEGER,
    "approval" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scientific_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "researcherId" TEXT NOT NULL,
    "role" "ParticipationRole" NOT NULL DEFAULT 'ATTENDANCE',
    "paperTitle" TEXT,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborations" (
    "id" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerType" "PartnerType" NOT NULL,
    "type" "CollaborationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "coordinator" TEXT,
    "approval" "RecordStatus" NOT NULL DEFAULT 'APPROVED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" TEXT NOT NULL,
    "researcherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AwardType" NOT NULL,
    "grantor" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "approval" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "journals_issn_key" ON "journals"("issn");

-- CreateIndex
CREATE INDEX "journals_name_idx" ON "journals"("name");

-- CreateIndex
CREATE INDEX "research_projects_status_idx" ON "research_projects"("status");

-- CreateIndex
CREATE INDEX "research_projects_departmentId_idx" ON "research_projects"("departmentId");

-- CreateIndex
CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");

-- CreateIndex
CREATE INDEX "project_reports_projectId_idx" ON "project_reports"("projectId");

-- CreateIndex
CREATE INDEX "scientific_events_startDate_idx" ON "scientific_events"("startDate");

-- CreateIndex
CREATE INDEX "scientific_events_organizedByInstitute_idx" ON "scientific_events"("organizedByInstitute");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_eventId_researcherId_key" ON "event_participants"("eventId", "researcherId");

-- CreateIndex
CREATE INDEX "awards_researcherId_idx" ON "awards"("researcherId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storageKey_key" ON "attachments"("storageKey");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "research_papers_doi_idx" ON "research_papers"("doi");

-- CreateIndex
CREATE INDEX "research_papers_publicationYear_idx" ON "research_papers"("publicationYear");

-- CreateIndex
CREATE INDEX "research_papers_indexing_idx" ON "research_papers"("indexing");

-- AddForeignKey
ALTER TABLE "research_papers" ADD CONSTRAINT "research_papers_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "researchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "scientific_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
