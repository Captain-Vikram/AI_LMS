import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import CreateClassroom from '../../components/Classroom/CreateClassroom';
import apiClient from '../../services/apiClient';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../services/apiClient');

describe('CreateClassroom integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
  });

  it('submits required fields as FormData and navigates to dashboard', async () => {
    apiClient.post.mockResolvedValue({ classroom_id: 'class123' });

    const { container } = render(
      <BrowserRouter>
        <CreateClassroom />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Grade 9 - Foundations of Algebra'), {
      target: { value: 'Grade 9 Algebra' },
    });
    fireEvent.change(screen.getByPlaceholderText('Mathematics'), { target: { value: 'Mathematics' } });
    fireEvent.change(screen.getByPlaceholderText('9'), { target: { value: '9' } });
    fireEvent.change(screen.getByPlaceholderText('Describe what this subject covers for this classroom.'), {
      target: { value: 'Covers foundational algebra concepts for middle school students.' },
    });
    fireEvent.change(screen.getByPlaceholderText('List what students are expected to complete, build, or demonstrate.'), {
      target: { value: 'Students should solve linear equations and explain reasoning.' },
    });

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    const pdf = new File(['%PDF-1.4 test'], 'algebra.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, {
      target: { files: [pdf] },
    });

    fireEvent.click(screen.getByRole('button', { name: /create classroom/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    const [, payload] = apiClient.post.mock.calls[0];
    expect(payload instanceof FormData).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('/classroom/class123/dashboard');
  });
});
