-- CreateSchema
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "password" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "city" TEXT,
    "pace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "bookmarks_userId_courseId_key" ON "bookmarks"("userId", "courseId");
CREATE INDEX "bookmarks_userId_idx" ON "bookmarks"("userId");
CREATE INDEX "bookmarks_courseId_idx" ON "bookmarks"("courseId");
CREATE INDEX "search_history_userId_idx" ON "search_history"("userId");
CREATE INDEX "search_history_createdAt_idx" ON "search_history"("createdAt");

ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
