-- The same evidence may be carried forward onto a new revision when the
-- applicant resubmits without replacing a photo: the Cloudinary asset is
-- identical, but each revision keeps its own image rows so the history of
-- what evidence supported WHICH revision is preserved.
DROP INDEX "ApplicationImage_r2Key_key";
