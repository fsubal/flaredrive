"use client";
import { useLocation } from "flaredrive/client";

export function CurrentLocation() {
  const url = useLocation();
  return (
    <code data-testid="location">
      {url.pathname}
      {url.search}
    </code>
  );
}
