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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Grid
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../services/api';
import { JournalEntry, Account } from '../types';

const JournalEntries: React.FC = () => {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  
  // New journal entry form state
  const [newEntry, setNewEntry] = useState({
    date: new Date(),
    reference: '',
    description: '',
    lines: [{ accountId: '', description: '', debit: 0, credit: 0 }]
  });

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
    const fetchData = async () => {
      if (!selectedOrganization) return;
      
      try {
        setLoading(true);
        const [entriesResponse, accountsResponse] = await Promise.all([
          api.get(`/organizations/${selectedOrganization}/journal-entries`),
          api.get(`/organizations/${selectedOrganization}/accounts`)
        ]);

        setJournalEntries(entriesResponse.data.data);
        setAccounts(accountsResponse.data.data);
        setError('');
      } catch (err) {
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedOrganization]);

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewEntry({
      date: new Date(),
      reference: '',
      description: '',
      lines: [{ accountId: '', description: '', debit: 0, credit: 0 }]
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setNewEntry({
      ...newEntry,
      [name as string]: value
    });
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setNewEntry({
        ...newEntry,
        date
      });
    }
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updatedLines = [...newEntry.lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    setNewEntry({
      ...newEntry,
      lines: updatedLines
    });
  };

  const addLine = () => {
    setNewEntry({
      ...newEntry,
      lines: [...newEntry.lines, { accountId: '', description: '', debit: 0, credit: 0 }]
    });
  };

  const removeLine = (index: number) => {
    const updatedLines = [...newEntry.lines];
    updatedLines.splice(index, 1);
    setNewEntry({
      ...newEntry,
      lines: updatedLines
    });
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post(`/organizations/${selectedOrganization}/journal-entries`, {
        ...newEntry,
        date: newEntry.date.toISOString().split('T')[0]
      });
      setJournalEntries([...journalEntries, response.data.data]);
      handleCloseDialog();
    } catch (err) {
      setError('Failed to create journal entry');
    }
  };

  const handleOrganizationChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedOrganization(e.target.value as string);
  };

  const calculateTotals = () => {
    let totalDebit = 0;
    let totalCredit = 0;
    
    newEntry.lines.forEach(line => {
      totalDebit += Number(line.debit) || 0;
      totalCredit += Number(line.credit) || 0;
    });
    
    return { totalDebit, totalCredit };
  };

  const { totalDebit, totalCredit } = calculateTotals();
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Journal Entries</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          New Journal Entry
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {organizations.length > 0 && (
        <FormControl fullWidth sx={{ mb: 3 }}>
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
                <TableCell>Status</TableCell>
                <TableCell>Total Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {journalEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No journal entries found</TableCell>
                </TableRow>
              ) : (
                journalEntries.map((entry) => {
                  const totalAmount = entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.reference}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.status}</TableCell>
                      <TableCell>${totalAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Create New Journal Entry</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Date"
                  value={newEntry.date}
                  onChange={handleDateChange}
                  sx={{ width: '100%' }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                name="reference"
                label="Reference"
                type="text"
                fullWidth
                value={newEntry.reference}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                name="description"
                label="Description"
                type="text"
                fullWidth
                value={newEntry.description}
                onChange={handleInputChange}
              />
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Journal Entry Lines</Typography>
          
          {newEntry.lines.map((line, index) => (
            <Box key={index} sx={{ mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Account</InputLabel>
                    <Select
                      value={line.accountId}
                      label="Account"
                      onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                    >
                      {accounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Description"
                    type="text"
                    fullWidth
                    value={line.description}
                    onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    label="Debit"
                    type="number"
                    fullWidth
                    value={line.debit}
                    onChange={(e) => handleLineChange(index, 'debit', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    label="Credit"
                    type="number"
                    fullWidth
                    value={line.credit}
                    onChange={(e) => handleLineChange(index, 'credit', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <IconButton 
                    color="error" 
                    onClick={() => removeLine(index)}
                    disabled={newEntry.lines.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Box>
          ))}

          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={addLine}
            sx={{ mt: 1 }}
          >
            Add Line
          </Button>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Grid container>
              <Grid item xs={6}>
                <Typography variant="subtitle1">Total Debit: ${totalDebit.toFixed(2)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">Total Credit: ${totalCredit.toFixed(2)}</Typography>
              </Grid>
            </Grid>
            {!isBalanced && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Journal entry is not balanced. Total debits must equal total credits.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            color="primary"
            disabled={!isBalanced}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default JournalEntries;
