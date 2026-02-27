import { useState, useEffect, useMemo, FormEvent } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction } from './types';
import { Pencil, Save, X, Trash2 } from 'lucide-react';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [observation, setObservation] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSplit, setIsSplit] = useState(true);

  const [person1Name, setPerson1Name] = useState('Pessoa 1');
  const [person2Name, setPerson2Name] = useState('Pessoa 2');
  const [paidBy, setPaidBy] = useState('');

  const [isEditingNames, setIsEditingNames] = useState(false);
  const [tempPerson1Name, setTempPerson1Name] = useState('');
  const [tempPerson2Name, setTempPerson2Name] = useState('');

  useEffect(() => {
    const namesDocRef = doc(db, 'config', 'names');
    const unsubscribe = onSnapshot(namesDocRef, (doc) => {
      if (doc.exists()) {
        const names = doc.data();
        setPerson1Name(names.person1Name);
        setPerson2Name(names.person2Name);
        setTempPerson1Name(names.person1Name);
        setTempPerson2Name(names.person2Name);
        if (!paidBy) setPaidBy(names.person1Name);
      } else {
        setDoc(namesDocRef, { person1Name: 'Pessoa 1', person2Name: 'Pessoa 2' });
      }
    });
    return () => unsubscribe();
  }, [paidBy]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({
          id: doc.id,
          amount: data.amount,
          paidBy: data.paidBy,
          observation: data.observation,
          timestamp: data.timestamp.toDate(),
          deleted: data.deleted || false,
          isSplit: data.isSplit === undefined ? true : data.isSplit,
        });
      });
      setTransactions(transactionsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const balance = useMemo(() => {
    return transactions
      .filter(tx => !tx.deleted)
      .reduce((acc, transaction) => {
        const value = transaction.isSplit ? transaction.amount / 2 : transaction.amount;
        if (transaction.paidBy === person1Name) {
          return acc + value;
        } else {
          return acc - value;
        }
      }, 0);
  }, [transactions, person1Name]);

  const handleAddTransaction = async (e: FormEvent) => {
    e.preventDefault();
    const amountNumber = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNumber) || amountNumber <= 0) {
      alert('Por favor, insira um valor válido.');
      return;
    }

    try {
      await addDoc(collection(db, 'transactions'), {
        amount: amountNumber,
        paidBy,
        observation,
        timestamp: Timestamp.now(),
        deleted: false,
        isSplit,
      });
      setAmount('');
      setObservation('');
    } catch (error) {
      console.error('Erro ao adicionar transação: ', error);
      alert('Falha ao adicionar transação.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      const transactionDoc = doc(db, 'transactions', id);
      try {
        await updateDoc(transactionDoc, { deleted: true });
      } catch (error) {
        console.error('Erro ao excluir transação: ', error);
        alert('Falha ao excluir transação.');
      }
    }
  };

  const handleSaveNames = async () => {
    const namesDocRef = doc(db, 'config', 'names');
    try {
      await setDoc(namesDocRef, { person1Name: tempPerson1Name, person2Name: tempPerson2Name });
      setIsEditingNames(false);
    } catch (error) {
      console.error('Erro ao salvar nomes: ', error);
      alert('Falha ao salvar nomes.');
    }
  };

  const handleCancelEditNames = () => {
    setTempPerson1Name(person1Name);
    setTempPerson2Name(person2Name);
    setIsEditingNames(false);
  };

  const getBalanceMessage = () => {
    const formattedBalance = `R$${Math.abs(balance).toFixed(2).replace('.', ',')}`;
    if (balance > 0) {
      return `${person2Name} deve a ${person1Name} ${formattedBalance}`;
    }
    if (balance < 0) {
      return `${person1Name} deve a ${person2Name} ${formattedBalance}`;
    }
    return 'Tudo certo!';
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800">Controle de Contas</h1>
        <p className="text-slate-500 mt-2">Acompanhe despesas compartilhadas entre duas pessoas.</p>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Nomes</h2>
          {!isEditingNames && (
            <button onClick={() => setIsEditingNames(true)} className="text-slate-500 hover:text-indigo-600">
              <Pencil size={18} />
            </button>
          )}
        </div>
        {isEditingNames ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={tempPerson1Name}
              onChange={(e) => setTempPerson1Name(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <input
              type="text"
              value={tempPerson2Name}
              onChange={(e) => setTempPerson2Name(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 mt-2">
              <button onClick={handleSaveNames} className="p-2 text-slate-500 hover:text-green-600"><Save size={20} /></button>
              <button onClick={handleCancelEditNames} className="p-2 text-slate-500 hover:text-red-600"><X size={20} /></button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="font-medium text-slate-800 truncate">{person1Name}</p>
            <p className="font-medium text-slate-800 truncate">{person2Name}</p>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Saldo Atual</h2>
        <p className={`text-2xl font-bold ${balance === 0 ? 'text-green-600' : 'text-slate-800'}`}>
          {getBalanceMessage()}
        </p>
      </div>

      <form onSubmit={handleAddTransaction} className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Adicionar Nova Transação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-slate-600 mb-1">Valor</label>
            <input
              id="amount"
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Pago por</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaidBy(person1Name)} className={`w-full py-2 rounded-md text-sm font-semibold transition-colors ${paidBy === person1Name ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{person1Name}</button>
              <button type="button" onClick={() => setPaidBy(person2Name)} className={`w-full py-2 rounded-md text-sm font-semibold transition-colors ${paidBy === person2Name ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{person2Name}</button>
            </div>
          </div>
        </div>
        <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Lançamento</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsSplit(true)} className={`w-full py-2 rounded-md text-sm font-semibold transition-colors ${isSplit ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Dividir Valor</button>
              <button type="button" onClick={() => setIsSplit(false)} className={`w-full py-2 rounded-md text-sm font-semibold transition-colors ${!isSplit ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Valor Inteiro</button>
            </div>
        </div>
        <div className="mb-4">
          <label htmlFor="observation" className="block text-sm font-medium text-slate-600 mb-1">Observação (Opcional)</label>
          <input
            id="observation"
            type="text"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: Supermercado, Jantar, etc."
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">Adicionar Transação</button>
      </form>

      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Histórico</h2>
        {loading ? (
          <p className="text-slate-500 text-center">Carregando histórico...</p>
        ) : transactions.length === 0 ? (
          <p className="text-slate-500 text-center">Nenhuma transação ainda.</p>
        ) : (
          <ul className="space-y-3">
            {transactions.map((tx) => (
              <li key={tx.id} className={`bg-white p-4 rounded-lg shadow-sm flex justify-between items-center transition-opacity ${tx.deleted ? 'opacity-50' : ''}`}>
                <div className={`${tx.deleted ? 'line-through text-slate-400' : ''}`}>
                  <p className={`font-semibold ${tx.deleted ? '' : 'text-slate-800'}`}>
                    {tx.paidBy} pagou R${tx.amount.toFixed(2).replace('.', ',')}
                    <span className="text-xs font-normal text-slate-400 ml-2">({tx.isSplit ? 'Dividido' : 'Inteiro'})</span>
                  </p>
                  {tx.observation && <p className={`text-sm ${tx.deleted ? '' : 'text-slate-500'}`}>{tx.observation}</p>}
                </div>
                <div className="flex items-center gap-2">
                   <p className={`text-xs ${tx.deleted ? 'text-slate-400' : 'text-slate-400'}`}>{tx.timestamp.toLocaleDateString()} {tx.timestamp.toLocaleTimeString()}</p>
                  {!tx.deleted && (
                    <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
