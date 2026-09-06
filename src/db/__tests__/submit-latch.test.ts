import { createSubmitLatch } from '../submit-latch';

/**
 * The reported bug is a double-tapped Save producing two expenses. Every case
 * below is written against a *synchronous* body, because that is what the
 * repositories are and what defeated the previous in-flight guard.
 */
describe('createSubmitLatch', () => {
  it('ignores a second tap after a synchronous save has already succeeded', async () => {
    const latch = createSubmitLatch();
    const save = jest.fn(() => true);

    // The first tap. The write is synchronous, so it is finished by the time
    // this resolves and nothing is "in flight" any more.
    await latch.run(save);
    // The second tap, as it arrives in life: a separate event, well afterwards.
    await latch.run(save);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports the second tap as not settled', async () => {
    const latch = createSubmitLatch();

    await expect(latch.run(() => true)).resolves.toBe(true);
    await expect(latch.run(() => true)).resolves.toBe(false);
  });

  it('collapses taps that land in the same tick', async () => {
    const latch = createSubmitLatch();
    const save = jest.fn(async () => true);

    await Promise.all([latch.run(save), latch.run(save), latch.run(save)]);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reopens after a failed save so the user can retry', async () => {
    const latch = createSubmitLatch();
    const save = jest.fn(() => false);

    await latch.run(save);
    await latch.run(save);

    expect(save).toHaveBeenCalledTimes(2);
    expect(latch.isLatched).toBe(false);
  });

  it('reopens after a throw, and lets the error through', async () => {
    const latch = createSubmitLatch();
    const boom = new Error('disk full');

    await expect(
      latch.run(() => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(latch.isLatched).toBe(false);
    await expect(latch.run(() => true)).resolves.toBe(true);
  });

  it('stays closed until it is reset, for a surface that is used again', async () => {
    const latch = createSubmitLatch();
    const save = jest.fn(() => true);

    await latch.run(save);
    await latch.run(save);
    expect(save).toHaveBeenCalledTimes(1);

    // The sheet reopens: this is a new settlement, not the same one twice.
    latch.reset();
    await latch.run(save);

    expect(save).toHaveBeenCalledTimes(2);
  });
});
