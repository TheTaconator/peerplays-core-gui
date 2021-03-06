/*
 *  Copyright (c) 2015 Cryptonomex, Inc., and contributors.
 *
 *  The MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

import React from "react";
import {connect} from 'react-redux';
import Translate from "react-translate-component";
import {ChainStore} from "peerplaysjs-lib";
import market_utils from "common/market_utils";
import utils from "common/utils";
import {FormattedDate} from "react-intl";
import PriceText from "../Utility/PriceText";
import MarketRepository from "repositories/MarketRepository";
import {setTransaction} from 'actions/RTransactionConfirmActions';
import SendPageActions from 'actions/SendPageActions';
import ExchangePageActions from 'actions/ExchangePageActions';
import {setWalletPosition} from 'actions/RWalletUnlockActions';
import AssetName from "../Explorer/BlockChain/AssetName";
import Repository from 'repositories/chain/repository';

let callback = {
	exists: false,
	run: null
};

@connect(
	(state) => {
		return {
			baseAsset: state.exchangePageReducer.baseAsset,
			quoteAsset: state.exchangePageReducer.quoteAsset,
			openOrders: state.exchangePageReducer.openOrders,
			currentAccount: state.account.currentAccount,
			walletLocked: state.wallet.locked,
			walletIsOpen: state.wallet.isOpen
		};
	},
	{
		setWalletPosition,
		setTransaction,
        removeOrderFromPage: ExchangePageActions.removeOrderFromPage,
        updateData: ExchangePageActions.updateData
	}
)
export default class ExchangeOpenOrders extends React.Component {

	componentWillUpdate(nextProps) {
		const {walletLocked} = this.props;

		if(!nextProps.walletLocked && nextProps.walletLocked != walletLocked) {
			if(callback.exists && callback.run) {
				callback.exists = false;
				callback.run(nextProps.walletLocked);
				callback.run = null;
			}
		}

	}

	_onCancel(orderId, e) {
		if(e) {
			e.preventDefault();
		}

		let {walletLocked, walletModalOpened} = this.props;

		if(walletLocked && !walletModalOpened) {
			callback.exists = true;
			callback.run = this._cancelOrder.bind(this, orderId);
			this.props.setWalletPosition(true);
			return;
		}

		this._cancelOrder(orderId, walletLocked);
	}

	_cancelOrder(orderId, walletLocked) {

		let {currentAccount} = this.props;

		if(walletLocked) {
			return;
		}

		let account = ChainStore.getAccount(currentAccount);

		MarketRepository.cancelOrder(
			currentAccount,
			orderId
		).then((tr)=> {
			tr.set_required_fees().then(() => {

                Repository.getAsset(tr.operations[0][1].fee.asset_id).then((asset) => {
                    if (asset) {
                        this.props.setTransaction('limit_order_cancel', {
                            fee: {
                                amount: 0,
                                asset_id: tr.operations[0][1].fee.asset_id,
                                asset: asset.toJS()
                            },
                            fee_paying_account: account.get('id'),
                            order: orderId,
                            proposedOperation: `Cancel order ${orderId}`,
                            transactionFunction: SendPageActions.transferTransaction,
                            transactionFunctionCallback: () => {
                                this.props.removeOrderFromPage(orderId);
                            },
                            transactionObject: tr,
                            functionArguments: tr
                        });
                    }
                });

			});
		});
	}

	_createRows(accountId) {
		let {openOrders, baseAsset, quoteAsset} = this.props;
		let key = 0;
		return openOrders
			.filter((order)=> {
				return order.seller == accountId;
			})
			.map((order) => {

				let {value, price, amount} = market_utils.parseOrder(order, baseAsset, quoteAsset);

				return (
					<div className="tableRow rel" key={"my_order_" + key++}>
						<div className="tableCell">
							<PriceText preFormattedPrice={price} markedClass={"mark2"} simpleClass={""}/>
						</div>
						<div className="tableCell text_r">{utils.format_number(amount, quoteAsset.precision)}</div>
						<div className="tableCell text_r">{utils.format_number(value, baseAsset.precision)}</div>
						<div className="tableCell text_r">
							<FormattedDate value={order.expiration} format="short"/>
							<a href="" className="tableRow__del" onClick={this._onCancel.bind(this, order.id)}>
								<span className="tableRow__delIcon icon-close" />
							</a>
						</div>
					</div>
				);
			});
	}

	render() {
		let {baseAsset, quoteAsset, currentAccount} = this.props;

		let account = ChainStore.getAccount(currentAccount);

		let orders = account ? this._createRows(account.get('id')) : [];

		return (
			<div className="ex-my-open-orders">
				<section className="section">
					<div className="section__title">
						MY OPEN ORDERS
					</div>
					<div className="section__table">
						<div className="table table3 table-sm">
							<div className="table__head tableRow">
								<div className="tableCell "><Translate content="exchange.price"/></div>
								<div className="tableCell text_r"><AssetName asset={quoteAsset} /></div>
								<div className="tableCell text_r"><AssetName asset={baseAsset} /></div>
								<div className="tableCell text_r"><Translate content="transaction.expiration"/></div>
							</div>
							<div className="table__body">
								{orders.length ? orders :
									<div className="table__empty h-515">
										<div className="table__emptyIn">No open Orders</div>
									</div>
								}
							</div>
						</div>
					</div>
				</section>
			</div>
		);
	}
}
