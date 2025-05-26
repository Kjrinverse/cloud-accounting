import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../services/api';
import { GeneralLedgerEntry } from '../types';

const GeneralLedger: React.FC = () => {
  const [entries, setEntries] = useState<GeneralLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), 0, 1));
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await api.get('/organizations');
        setOrganizations(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedOrganization(response.data.data[0].id);
        }
      } catch (err) {
        setError('Failed to fetch organizations');
      }
    };

    fetchOrganizations();
  }, []);

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!selectedOrganization) return;
      
      try {
        const response = await api.get(`/organizations/${selectedOrganization}/accounts`);
        setAccounts(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedAccount(response.data.data[0].id);
        }
      } catch (err) {
        setError('Failed to fetch accounts');
      }
    };

    fetchAccounts();
  }, [selectedOrganization]);

  useEffect(() => {
    const fetchGeneralLedger = async () => {
      if (!selectedOrganization || !selectedAccount || !startDate || !endDate) return;
      
      try {
        setLoading(true);
        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = endDate.toISOString().split('T')[0];
        
        const response = await api.get(
          `/organizations/${selectedOrganization}/general-ledger`, 
          { params: { accountId: selectedAccount, startDate: formattedStartDate, endDate: formattedEndDate } }
        );
        
        setEntries(response.data.data);
        setError('');
      } catch (err) {
        setError('Failed to fetch general ledger data');
      } finally {
        setLoading(false);
      }
    };

    fetchGeneralLedger();
  }, [selectedOrganization, selectedAccount, startDate, endDate]);

  const handleOrganizationChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedOrganization(e.target.value as string);
    setSelectedAccount('');
  };

  const handleAccountChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedAccount(e.target.value as string);
  };

  const getAccountName = () => {
    const account = accounts.find(acc => acc.id === selectedAccount);
    return account ? `${account.code} - ${account.name}` : '';
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>General Ledger</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Organization</InputLabel>
              <Select
                value={selectedOrganization}
                label="Organization"
                onChange={handleOrganizationChange}
              >
                {organizations.map((org) => (
                  <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Account</InputLabel>
              <Select
                value={selectedAccount}
                label="Account"
                onChange={handleAccountChange}
                disabled={accounts.length === 0}
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(date) => setStartDate(date)}
                sx={{ width: '100%' }}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(date) => setEndDate(date)}
                sx={{ width: '100%' }}
              />
            </LocalizationProvider>
          </Grid>
        </Grid>
      </Paper>

      {selectedAccount && (
        <Typography variant="h6" gutterBottom>
          Account: {getAccountName()}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">No entries found</TableCell>
                </TableRow>
              ) : (
                entries.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.reference}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell align="right">{entry.debit > 0 ? `$${entry.debit.toFixed(2)}` : ''}</TableCell>
                    <TableCell align="right">{entry.credit > 0 ? `$${entry.credit.toFixed(2)}` : ''}</TableCell>
                    <TableCell align="right">${entry.balance.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default GeneralLedger;
