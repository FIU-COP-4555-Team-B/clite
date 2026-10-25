import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import sample from '../../samples/full-scope.clite?raw';
import { App } from './App';

afterEach(() => vi.useRealTimers());

function tokenStream() {
  return within(screen.getByRole('region', { name: 'Token stream' }));
}

function edit(source: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Source code' }), { target: { value: source } });
}

function playToEnd() {
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  act(() => vi.advanceTimersByTime(20_000));
}

describe('lexer interface', () => {
  it('loads the example and exposes the initial recognition state', () => {
    render(<App />);

    expect(screen.getByRole('textbox', { name: 'Source code' })).toHaveValue(sample);
    expect(screen.getByTestId('playback-status')).toHaveTextContent('Ready');
    expect(tokenStream().getByText('0 emitted')).toBeInTheDocument();
    expect(screen.getByText('0 transitions')).toBeInTheDocument();
  });

  it('steps through character consumption before emitting a token', async () => {
    const user = userEvent.setup();

    render(<App />);
    edit('a');

    await user.click(screen.getByRole('button', { name: 'Step →' }));

    expect(screen.getByText('1 transition')).toBeInTheDocument();
    expect(tokenStream().getByText('0 emitted')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Inside the lexer' })).getByText('"a"')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Step →' }));

    expect(tokenStream().getByText('identifier')).toBeInTheDocument();
    expect(tokenStream().getByText('1 emitted')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Step →' }));

    expect(screen.getByTestId('playback-status')).toHaveTextContent('Complete');
    expect(tokenStream().getByText('eof')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step →' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  });

  it('runs, pauses, resumes, and stops at EOF without duplicating tokens', () => {
    vi.useFakeTimers();
    render(<App />);
    edit('int x;');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    act(() => vi.advanceTimersByTime(60));

    expect(screen.getByTestId('playback-status')).toHaveTextContent('Running');
    expect(screen.getByText('1 transition')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByText('1 transition')).toBeInTheDocument();
    expect(screen.getByTestId('playback-status')).toHaveTextContent('Paused');

    playToEnd();

    expect(screen.getByTestId('playback-status')).toHaveTextContent('Complete');
    expect(tokenStream().getByText('4 emitted')).toBeInTheDocument();
    expect(tokenStream().getAllByText('eof')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resets execution while preserving the input', () => {
    vi.useFakeTimers();
    render(<App />);
    edit('false');
    playToEnd();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('textbox', { name: 'Source code' })).toHaveValue('false');
    expect(screen.getByTestId('playback-status')).toHaveTextContent('Ready');
    expect(tokenStream().getByText('0 emitted')).toBeInTheDocument();
    expect(screen.getByText('0 transitions')).toBeInTheDocument();
  });

  it('clears output and stops playback when source changes', () => {
    vi.useFakeTimers();
    render(<App />);
    edit('int a;');
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    act(() => vi.advanceTimersByTime(360));
    edit('bool b');
    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByTestId('playback-status')).toHaveTextContent('Ready');
    expect(screen.getByText('0 transitions')).toBeInTheDocument();
    expect(tokenStream().getByText('0 emitted')).toBeInTheDocument();
  });

  it('shows diagnostics and continues to valid tokens', () => {
    vi.useFakeTimers();
    render(<App />);
    edit('@ int');
    playToEnd();

    expect(screen.getByTestId('playback-status')).toHaveTextContent('Complete');
    expect(within(screen.getByRole('region', { name: 'Diagnostics' })).getByText('1 error')).toBeInTheDocument();
    expect(tokenStream().getByText('int')).toBeInTheDocument();
    expect(tokenStream().getByText('eof')).toBeInTheDocument();
  });

  it('highlights a selected token in the source trace', () => {
    vi.useFakeTimers();
    render(<App />);
    edit('int a;');
    playToEnd();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect token 1: int' }));

    const trace = screen.getByLabelText('Source trace');

    expect(trace.querySelector('mark')).toHaveTextContent('int');
  });

  it('handles empty source and restores the example', () => {
    vi.useFakeTimers();
    render(<App />);
    edit('');
    playToEnd();

    expect(screen.getByTestId('playback-status')).toHaveTextContent('Complete');
    expect(tokenStream().getByText('1 emitted')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load example' }));

    expect(screen.getByRole('textbox', { name: 'Source code' })).toHaveValue(sample);
    expect(screen.getByTestId('playback-status')).toHaveTextContent('Ready');
  });

  it('loads a local text file and starts a fresh execution', async () => {
    const user = userEvent.setup();
    const file = new File(['char c'], 'test.clite', { type: 'text/plain' });

    Object.defineProperty(file, 'text', { value: async () => 'char c' });
    render(<App />);

    await user.upload(screen.getByLabelText('Open source file'), file);

    expect(screen.getByRole('textbox', { name: 'Source code' })).toHaveValue('char c');
    expect(screen.getByTestId('playback-status')).toHaveTextContent('Ready');
  });

  it('reports a file read failure without losing the source', async () => {
    const user = userEvent.setup();
    const file = new File([], 'broken.clite', { type: 'text/plain' });

    Object.defineProperty(file, 'text', { value: async () => { throw new Error('Read failed'); } });
    render(<App />);

    await user.upload(screen.getByLabelText('Open source file'), file);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not read this file');
    expect(screen.getByRole('textbox', { name: 'Source code' })).toHaveValue(sample);
  });

  it('does not overwrite newer edits when an earlier file read finishes', async () => {
    const user = userEvent.setup();
    const file = new File([], 'slow.clite', { type: 'text/plain' });
    let resolveRead: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => { resolveRead = resolve; });

    Object.defineProperty(file, 'text', { value: () => pending });
    render(<App />);

    await user.upload(screen.getByLabelText('Open source file'), file);
    edit('newer');
    await act(async () => resolveRead('older'));

    expect(screen.getByRole('textbox', { name: 'Source code' })).toHaveValue('newer');
  });

  it('completes the full-scope example without lexical errors', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Playback' }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    act(() => vi.advanceTimersByTime(40_000));

    expect(screen.getByTestId('playback-status')).toHaveTextContent('Complete');
    expect(tokenStream().getByText('eof')).toBeInTheDocument();
    expect(screen.getByText('No lexical errors.')).toBeInTheDocument();
  });
});
