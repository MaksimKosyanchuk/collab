-- CreateTable
CREATE TABLE "DocumentShareInvitation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "access" "DocumentAccess" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentShareInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentShareInvitation_documentId_email_status_idx" ON "DocumentShareInvitation"("documentId", "email", "status");

-- CreateIndex
CREATE INDEX "DocumentShareInvitation_email_status_idx" ON "DocumentShareInvitation"("email", "status");

-- AddForeignKey
ALTER TABLE "DocumentShareInvitation" ADD CONSTRAINT "DocumentShareInvitation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShareInvitation" ADD CONSTRAINT "DocumentShareInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
