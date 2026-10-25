"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreparationResponse } from "../contracts/booking-preparation";
import { subscribeDepositChanges } from "./booking-deposit-refresh";

/** One in-flight read per view; discard old booking and pre-mutation responses. */
export function useBookingPreparationRead(shopId: string, appointmentId: string, busy: boolean, request: (details: boolean) => Promise<PreparationResponse>) {
  const [stored, store] = useState<PreparationResponse | null>(null);
  const identity = `${shopId}:${appointmentId}`, current = useRef(identity), epoch = useRef(0), writing = useRef(busy);
  const flights = useRef(new Map<string, Promise<PreparationResponse>>());
  if (current.current !== identity || writing.current !== busy) { current.current = identity; writing.current = busy; epoch.current++; }
  const load = useCallback((details = false) => {
    const generation = epoch.current, key = `${identity}:${generation}:${details}`;
    const previous = flights.current.get(key); if (previous) return previous;
    const task = request(details).then(next => {
      if (current.current !== identity || generation !== epoch.current) throw new Error("STALE_PREPARATION_READ");
      return next;
    }).finally(() => { flights.current.delete(key); });
    flights.current.set(key, task); return task;
  }, [identity, request]);
  const setResult = useCallback((next: PreparationResponse | null) => {
    if (!next) { store(null); return; }
    if (`${next.shopId}:${next.appointmentId}` !== current.current) return;
    store(previous => {
      if (previous?.ledger && next.ledger && previous.ledger.id === next.ledger.id && next.ledger.version < previous.ledger.version) return previous;
      // Polling should not erase an expanded history with the same ledger version.
      if (previous?.ledger && next.ledger && previous.ledger.id === next.ledger.id && previous.ledger.version === next.ledger.version && next.ledger.historyLoaded === false && previous.ledger.historyLoaded !== false) return { ...next, availableDeposits: previous.availableDeposits, previousDepositRefunds: previous.previousDepositRefunds, ledger: { ...next.ledger, history: previous.ledger.history, relatedBookings: previous.ledger.relatedBookings, movements: previous.ledger.movements, historyLoaded: true } };
      return next;
    });
  }, []);
  const loadRef = useRef(load); loadRef.current = load;
  const hasLedger = useRef(false); hasLedger.current = Boolean(stored?.shopId === shopId && stored.appointmentId === appointmentId && stored.ledger);
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !writing.current) void loadRef.current().then(setResult).catch(() => {}); };
    const changed = () => { epoch.current++; refresh(); };
    const timer = window.setInterval(() => { if (hasLedger.current) refresh(); }, 15000), stop = subscribeDepositChanges(shopId, changed);
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { stop(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [shopId, setResult]);
  return { result: stored?.shopId === shopId && stored.appointmentId === appointmentId ? stored : null, setResult, load };
}
