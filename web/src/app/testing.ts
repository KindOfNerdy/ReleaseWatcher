/** Test helper: lets pending promise chains (firstValueFrom/Promise.all) resolve, then renders. */
export async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
  fixture.detectChanges();
}
