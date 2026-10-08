// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Gallery is ERC721Enumerable, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;

    uint256 public constant MARKETPLACE_FEE = 250;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant MAX_ROYALTY = 1000;

    uint256 public nextTokenId;
    uint256 public totalListed;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => RoyaltyInfo) public royalties;

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    struct RoyaltyInfo {
        address recipient;
        uint256 percentage;
    }

    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI);
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event NFTDelisted(uint256 indexed tokenId, address indexed seller);
    event RoyaltySet(uint256 indexed tokenId, address recipient, uint256 percentage);

    constructor(address _paymentToken) ERC721("Gallery", "GLRY") Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
    }

    function mint(string memory uri) external nonReentrant returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        emit NFTMinted(tokenId, msg.sender, uri);
        return tokenId;
    }

    function list(uint256 tokenId, uint256 price) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");
        require(!listings[tokenId].active, "Already listed");
        listings[tokenId] = Listing({seller: msg.sender, price: price, active: true});
        totalListed++;
        emit NFTListed(tokenId, msg.sender, price);
    }

    function delist(uint256 tokenId) external nonReentrant {
        require(listings[tokenId].active, "Not listed");
        require(listings[tokenId].seller == msg.sender, "Not seller");
        listings[tokenId].active = false;
        totalListed--;
        emit NFTDelisted(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(msg.sender != listing.seller, "Cannot buy own NFT");

        address seller = listing.seller;
        uint256 price = listing.price;

        uint256 fee = price * MARKETPLACE_FEE / FEE_DENOMINATOR;
        uint256 sellerProceeds = price - fee;

        RoyaltyInfo memory royalty = royalties[tokenId];
        uint256 royaltyAmount = 0;
        if (royalty.recipient != address(0) && royalty.percentage > 0) {
            royaltyAmount = price * royalty.percentage / FEE_DENOMINATOR;
            sellerProceeds -= royaltyAmount;
        }

        paymentToken.safeTransferFrom(msg.sender, owner(), fee);
        paymentToken.safeTransferFrom(msg.sender, seller, sellerProceeds);
        if (royaltyAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, royalty.recipient, royaltyAmount);
        }

        _transfer(seller, msg.sender, tokenId);
        listings[tokenId].active = false;
        totalListed--;

        emit NFTSold(tokenId, msg.sender, seller, price);
    }

    function setRoyalty(uint256 tokenId, address recipient, uint256 percentage) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(percentage <= MAX_ROYALTY, "Royalty too high");
        royalties[tokenId] = RoyaltyInfo({recipient: recipient, percentage: percentage});
        emit RoyaltySet(tokenId, recipient, percentage);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function getAllListed() external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](totalListed);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (listings[i].active) {
                result[idx++] = i;
            }
        }
        return result;
    }

    mapping(uint256 => string) private _tokenURIs;

    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }
}
