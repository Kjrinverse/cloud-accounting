import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalRevenue: 0,
    totalExpenses: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const orgResponse = await api.get('/organizations');
        setOrganizations(orgResponse.data.data);

        if (orgResponse.data.data.length > 0) {
          const orgId = orgResponse.data.data[0].id;
          const statsResponse = await api.get(`/organizations/${orgId}/dashboard/stats`);
          setStats(statsResponse.data.data);
        }
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Typography variant="h6" gutterBottom>
        Welcome, {currentUser?.firstName} {currentUser?.lastName}
      </Typography>
      
      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light' }}>
          <Typography color="error">{error}</Typography>
        </Paper>
      )}
      
      {organizations.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6">No organizations found</Typography>
          <Typography variant="body1">
            Please create an organization to start using the accounting system.
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Assets" />
                <Divider />
                <CardContent>
                  <Typography variant="h4">${stats.totalAssets.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Liabilities" />
                <Divider />
                <CardContent>
                  <Typography variant="h4">${stats.totalLiabilities.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Equity" />
                <Divider />
                <CardContent>
                  <Typography variant="h4">${stats.totalEquity.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Revenue" />
                <Divider />
                <CardContent>
                  <Typography variant="h4">${stats.totalRevenue.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Expenses" />
                <Divider />
                <CardContent>
                  <Typography variant="h4">${stats.totalExpenses.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default Dashboard;
