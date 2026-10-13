"use client";

import { useEffect } from "react";
import { markRead } from "@/features/news/readState";

export function MarkRead({ id }: { id: string }) {
  useEffect(() => markRead(id), [id]);
  return null;
}
